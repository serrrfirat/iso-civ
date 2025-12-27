// Simple Supabase Realtime multiplayer provider

import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  GameAction,
  GameActionInput,
  Player,
  generatePlayerId,
  generatePlayerColor,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface MultiplayerProviderOptions {
  roomCode: string;
  cityName: string;
  playerName: string;
  isHost: boolean;
  initialGameState?: unknown;
  onConnectionChange?: (connected: boolean, peerCount: number) => void;
  onPlayersChange?: (players: Player[]) => void;
  onAction?: (action: GameAction) => void;
  onStateReceived?: (state: unknown) => void;
}

export class MultiplayerProvider {
  public readonly roomCode: string;
  public readonly peerId: string;
  public readonly isHost: boolean;

  private channel: RealtimeChannel;
  private player: Player;
  private options: MultiplayerProviderOptions;
  private players: Map<string, Player> = new Map();
  private initialGameState: unknown = null;
  private destroyed = false;

  constructor(options: MultiplayerProviderOptions) {
    this.options = options;
    this.roomCode = options.roomCode;
    this.isHost = options.isHost;
    this.peerId = generatePlayerId();
    this.initialGameState = options.initialGameState;

    // Create player info
    this.player = {
      id: this.peerId,
      name: options.playerName,
      color: generatePlayerColor(),
      joinedAt: Date.now(),
      isHost: options.isHost,
    };

    // Add self to players
    this.players.set(this.peerId, this.player);

    // Create Supabase Realtime channel
    this.channel = supabase.channel(`room-${options.roomCode}`, {
      config: {
        presence: { key: this.peerId },
        broadcast: { self: false }, // Don't receive our own broadcasts
      },
    });
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    // Set up presence (track who's in the room)
    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState();
        this.players.clear();
        this.players.set(this.peerId, this.player);

        Object.entries(state).forEach(([key, presences]) => {
          if (key !== this.peerId && presences.length > 0) {
            const presence = presences[0] as unknown as { player: Player };
            if (presence.player) {
              this.players.set(key, presence.player);
            }
          }
        });

        this.notifyPlayersChange();
        this.updateConnectionStatus();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== this.peerId && newPresences.length > 0) {
          const presence = newPresences[0] as unknown as { player: Player };
          if (presence.player) {
            this.players.set(key, presence.player);
            this.notifyPlayersChange();
            this.updateConnectionStatus();

            // Host sends initial state to new player
            if (this.isHost && this.initialGameState) {
              this.channel.send({
                type: 'broadcast',
                event: 'state-sync',
                payload: { state: this.initialGameState, to: key },
              });
            }
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        this.players.delete(key);
        this.notifyPlayersChange();
        this.updateConnectionStatus();
      });

    // Set up broadcast listeners
    this.channel
      .on('broadcast', { event: 'action' }, ({ payload }) => {
        const action = payload as GameAction;
        if (action.playerId !== this.peerId && this.options.onAction) {
          this.options.onAction(action);
        }
      })
      .on('broadcast', { event: 'state-sync' }, ({ payload }) => {
        const { state, to } = payload as { state: unknown; to?: string };
        // Only process if it's for us or broadcast to all
        if ((!to || to === this.peerId) && this.options.onStateReceived) {
          this.options.onStateReceived(state);
        }
      })
      .on('broadcast', { event: 'state-request' }, ({ payload }) => {
        const { from } = payload as { from: string };
        // Host responds to state requests
        if (this.isHost && this.initialGameState) {
          this.channel.send({
            type: 'broadcast',
            event: 'state-sync',
            payload: { state: this.initialGameState, to: from },
          });
        }
      });

    // Subscribe and track presence
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({ player: this.player });
        
        // Notify connected
        if (this.options.onConnectionChange) {
          this.options.onConnectionChange(true, this.players.size);
        }
        this.notifyPlayersChange();

        // Guest requests state from host
        if (!this.isHost) {
          this.channel.send({
            type: 'broadcast',
            event: 'state-request',
            payload: { from: this.peerId },
          });
        }
      }
    });
  }

  dispatchAction(action: GameActionInput): void {
    if (this.destroyed) return;

    const fullAction: GameAction = {
      ...action,
      timestamp: Date.now(),
      playerId: this.peerId,
    };

    // Broadcast to all peers
    this.channel.send({
      type: 'broadcast',
      event: 'action',
      payload: fullAction,
    });
  }

  updateGameState(state: unknown): void {
    this.initialGameState = state;
  }

  private updateConnectionStatus(): void {
    if (this.options.onConnectionChange) {
      this.options.onConnectionChange(true, this.players.size);
    }
  }

  private notifyPlayersChange(): void {
    if (this.options.onPlayersChange) {
      this.options.onPlayersChange(Array.from(this.players.values()));
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.channel.unsubscribe();
    supabase.removeChannel(this.channel);
  }
}

// Create and connect a multiplayer provider
export async function createMultiplayerProvider(
  options: MultiplayerProviderOptions
): Promise<MultiplayerProvider> {
  const provider = new MultiplayerProvider(options);
  await provider.connect();
  return provider;
}
