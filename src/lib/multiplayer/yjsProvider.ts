// Y.js provider with WebRTC connections and Twilio TURN

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import {
  GameAction,
  GameActionInput,
  Player,
  AwarenessState,
  generatePlayerId,
  generatePlayerColor,
} from './types';

// Signaling message types
interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to?: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  timestamp: number;
}

// Data channel message types
interface DataChannelMessage {
  type: 'sync' | 'update' | 'awareness' | 'state-sync' | 'state-request';
  data?: unknown;
}

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

// Cached ICE servers from Twilio
let cachedIceServers: RTCIceServer[] = [];
let iceServersFetched = false;

async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceServersFetched) return cachedIceServers;
  
  try {
    const res = await fetch('/api/turn');
    const data = await res.json();
    cachedIceServers = data.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
    ];
  } catch {
    // Fallback to STUN only
    cachedIceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }
  
  iceServersFetched = true;
  return cachedIceServers;
}

export class MultiplayerProvider {
  public readonly doc: Y.Doc;
  public readonly awareness: Awareness;
  public readonly roomCode: string;
  public readonly peerId: string;
  public readonly isHost: boolean;

  private player: Player;
  private options: MultiplayerProviderOptions;
  private operationsArray: Y.Array<GameAction>;
  private metaMap: Y.Map<unknown>;
  private lastAppliedIndex = 0;
  private destroyed = false;

  // WebRTC connections
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  // Polling-based signaling
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastSeenSignals = '';
  private connectedPeers: Set<string> = new Set();
  
  // Initial game state for P2P sync
  private initialGameState: unknown = null;
  
  // Buffer ICE candidates
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private outgoingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  constructor(options: MultiplayerProviderOptions) {
    this.options = options;
    this.roomCode = options.roomCode;
    this.isHost = options.isHost;
    this.peerId = generatePlayerId();

    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);

    this.operationsArray = this.doc.getArray<GameAction>('operations');
    this.metaMap = this.doc.getMap('meta');

    this.player = {
      id: this.peerId,
      name: options.playerName,
      color: generatePlayerColor(),
      joinedAt: Date.now(),
      isHost: options.isHost,
    };

    this.awareness.setLocalState({
      player: this.player,
    } as AwarenessState);

    if (options.isHost) {
      this.metaMap.set('hostId', this.peerId);
      this.metaMap.set('createdAt', Date.now());
      this.metaMap.set('cityName', options.cityName);
      this.metaMap.set('roomCode', options.roomCode);
      this.initialGameState = options.initialGameState;
    }

    // Listen for Y.js operations
    this.operationsArray.observe((event) => {
      if (event.changes.added.size > 0) {
        const newOps = this.operationsArray.slice(this.lastAppliedIndex);
        for (const op of newOps) {
          if (op.playerId !== this.peerId && this.options.onAction) {
            this.options.onAction(op);
          }
        }
        this.lastAppliedIndex = this.operationsArray.length;
      }
    });

    this.awareness.on('change', () => {
      this.notifyPlayersChange();
    });
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    // Notify initial connection
    if (this.options.onConnectionChange) {
      this.options.onConnectionChange(true, 1);
    }

    this.notifyPlayersChange();

    // Start polling for signaling messages
    this.startSignalPolling();

    // If not host, announce ourselves
    if (!this.isHost) {
      await this.announcePresence();
    }
  }

  private async announcePresence(): Promise<void> {
    try {
      const response = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          type: 'offer',
          from: this.peerId,
          payload: { type: 'announce', peerId: this.peerId, playerName: this.player.name },
        }),
      });
      if (!response.ok) {
        console.error('[MP] Announcement failed');
      }
    } catch (error) {
      console.error('[MP] Failed to announce presence:', error);
    }
  }

  private startSignalPolling(): void {
    if (this.pollingInterval) return;

    let pollCount = 0;
    let roomReady = !this.isHost;
    
    const pollSignals = async () => {
      if (this.destroyed) return;
      pollCount++;

      try {
        const response = await fetch(
          `/api/signal?roomCode=${this.roomCode}&peerId=${this.peerId}&lastSeen=${encodeURIComponent(this.lastSeenSignals)}`
        );

        if (response.ok) {
          roomReady = true;
          const { signals, lastSeen } = await response.json();
          this.lastSeenSignals = lastSeen || '';

          for (const signal of signals) {
            await this.handleSignal(signal);
          }
        } else if (response.status === 404 && this.isHost && pollCount <= 5) {
          // Room not in Edge Config yet, wait for propagation
        }
      } catch {
        // Ignore polling errors
      }

      // Check if room is ready for host
      if (this.isHost && !roomReady && pollCount <= 10) {
        try {
          const checkResponse = await fetch(`/api/room?code=${this.roomCode}`);
          if (checkResponse.ok) {
            roomReady = true;
          }
        } catch {
          // Ignore
        }
      }
    };

    // Poll immediately, then every 1 second
    pollSignals();
    this.pollingInterval = setInterval(pollSignals, 1000);
  }

  private async handleSignal(signal: SignalMessage): Promise<void> {
    const payloadType = (signal.payload as { type?: string })?.type;
    
    // Handle peer announcement
    if (signal.type === 'offer' && payloadType === 'announce') {
      if (this.isHost) {
        await this.createPeerConnection(signal.from, true);
      }
      return;
    }

    // Handle WebRTC offer
    const hasSdpPayload = (signal.payload as { sdp?: unknown })?.sdp;
    if (signal.type === 'offer' && (payloadType === 'offer' || hasSdpPayload)) {
      await this.handleOffer(signal);
    } else if (signal.type === 'answer') {
      await this.handleAnswer(signal);
    } else if (signal.type === 'ice-candidate') {
      await this.handleLegacyIceCandidate(signal);
    }
  }

  private async createPeerConnection(remotePeerId: string, createOffer: boolean): Promise<RTCPeerConnection> {
    let pc = this.peerConnections.get(remotePeerId);
    if (pc) return pc;

    const iceServers = await getIceServers();
    
    pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    });

    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`[MP] ICE state: ${pc!.iceConnectionState}`);
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[MP] ICE gathering: ${pc!.iceGatheringState}`);
    };

    pc.onicecandidateerror = (event) => {
      console.error(`[MP] ICE error:`, event.errorCode, event.url);
    };

    this.peerConnections.set(remotePeerId, pc);

    // Collect ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const pending = this.outgoingIceCandidates.get(remotePeerId) || [];
        pending.push(event.candidate.toJSON());
        this.outgoingIceCandidates.set(remotePeerId, pending);
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      if (pc!.connectionState === 'connected') {
        this.connectedPeers.add(remotePeerId);
        this.updateConnectionStatus();
        this.stopPollingIfConnected();
      } else if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
        this.connectedPeers.delete(remotePeerId);
        this.peerConnections.delete(remotePeerId);
        this.dataChannels.delete(remotePeerId);
        this.updateConnectionStatus();
      }
    };

    // Handle data channel
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, remotePeerId);
    };

    if (createOffer) {
      const channel = pc.createDataChannel('yjs');
      this.setupDataChannel(channel, remotePeerId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkComplete = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          pc.addEventListener('icegatheringstatechange', checkComplete);
          setTimeout(resolve, 5000); // 5 second timeout
        }
      });
      
      const candidates = this.outgoingIceCandidates.get(remotePeerId) || [];
      console.log(`[MP] Sending offer with ${candidates.length} candidates`);
      
      await this.sendSignal('offer', {
        sdp: pc.localDescription!.toJSON(),
        candidates: candidates,
      }, remotePeerId);
      this.outgoingIceCandidates.delete(remotePeerId);
    }

    return pc;
  }

  private setupDataChannel(channel: RTCDataChannel, remotePeerId: string): void {
    this.dataChannels.set(remotePeerId, channel);

    channel.onopen = () => {
      console.log(`[MP] Data channel OPEN with ${remotePeerId}`);
      this.syncDocument(remotePeerId);
      
      if (!this.isHost) {
        channel.send(JSON.stringify({ type: 'state-request' } as DataChannelMessage));
      }
    };

    channel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data, remotePeerId);
    };

    channel.onclose = () => {
      this.dataChannels.delete(remotePeerId);
    };
  }

  private syncDocument(remotePeerId: string): void {
    const state = Y.encodeStateAsUpdate(this.doc);
    const channel = this.dataChannels.get(remotePeerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'sync', data: Array.from(state) }));
    }

    const awarenessState = this.awareness.getLocalState();
    if (awarenessState && channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'awareness', data: awarenessState }));
    }
  }

  private handleDataChannelMessage(data: string, remotePeerId: string): void {
    try {
      const message = JSON.parse(data) as DataChannelMessage;

      if (message.type === 'sync' || message.type === 'update') {
        const update = new Uint8Array(message.data as number[]);
        Y.applyUpdate(this.doc, update);
      } else if (message.type === 'awareness') {
        this.notifyPlayersChange();
      } else if (message.type === 'state-request') {
        if (this.isHost && this.initialGameState) {
          const channel = this.dataChannels.get(remotePeerId);
          if (channel && channel.readyState === 'open') {
            channel.send(JSON.stringify({ 
              type: 'state-sync', 
              data: this.initialGameState 
            } as DataChannelMessage));
          }
        }
      } else if (message.type === 'state-sync') {
        if (this.options.onStateReceived && message.data) {
          this.options.onStateReceived(message.data);
        }
      }
    } catch (error) {
      console.error('[MP] Failed to handle message:', error);
    }
  }

  private async handleOffer(signal: SignalMessage): Promise<void> {
    try {
      const payload = signal.payload as { sdp: RTCSessionDescriptionInit; candidates: RTCIceCandidateInit[] };
      const offerSdp = payload.sdp || signal.payload as RTCSessionDescriptionInit;
      const offerCandidates = payload.candidates || [];
      
      const pc = await this.createPeerConnection(signal.from, false);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      
      // Add ICE candidates from offer
      for (const candidate of offerCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('[MP] Error adding ICE candidate:', e);
        }
      }

      // Add any buffered candidates
      const bufferedCandidates = this.pendingIceCandidates.get(signal.from) || [];
      for (const candidate of bufferedCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('[MP] Error adding buffered candidate:', e);
        }
      }
      this.pendingIceCandidates.delete(signal.from);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') resolve();
          });
          setTimeout(resolve, 5000);
        }
      });

      const candidates = this.outgoingIceCandidates.get(signal.from) || [];
      console.log(`[MP] Sending answer with ${candidates.length} candidates`);
      
      await this.sendSignal('answer', {
        sdp: pc.localDescription!.toJSON(),
        candidates: candidates,
      }, signal.from);
      this.outgoingIceCandidates.delete(signal.from);
    } catch (error) {
      console.error('[MP] Error handling offer:', error);
    }
  }

  private async handleAnswer(signal: SignalMessage): Promise<void> {
    const pc = this.peerConnections.get(signal.from);
    if (!pc) return;

    try {
      const payload = signal.payload as { sdp: RTCSessionDescriptionInit; candidates: RTCIceCandidateInit[] };
      const answerSdp = payload.sdp || signal.payload as RTCSessionDescriptionInit;
      const answerCandidates = payload.candidates || [];

      await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
      
      for (const candidate of answerCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('[MP] Error adding candidate:', e);
        }
      }
    } catch (error) {
      console.error('[MP] Error handling answer:', error);
    }
  }

  private async handleLegacyIceCandidate(signal: SignalMessage): Promise<void> {
    const pc = this.peerConnections.get(signal.from);
    const candidates = Array.isArray(signal.payload) 
      ? signal.payload as RTCIceCandidateInit[]
      : [signal.payload as RTCIceCandidateInit];

    if (pc && pc.remoteDescription) {
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('[MP] Error adding ICE candidate:', error);
        }
      }
    } else {
      const pending = this.pendingIceCandidates.get(signal.from) || [];
      pending.push(...candidates);
      this.pendingIceCandidates.set(signal.from, pending);
    }
  }

  private async sendSignal(type: 'offer' | 'answer' | 'ice-candidate', payload: unknown, to?: string): Promise<void> {
    try {
      const response = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          type,
          from: this.peerId,
          to,
          payload,
        }),
      });

      if (!response.ok) {
        console.error('[MP] Signal POST failed:', response.status);
      }
    } catch (error) {
      console.error('[MP] Failed to send signal:', error);
    }
  }

  private stopPollingIfConnected(): void {
    if (this.connectedPeers.size > 0 && this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private updateConnectionStatus(): void {
    const peerCount = this.connectedPeers.size + 1;
    if (this.options.onConnectionChange) {
      this.options.onConnectionChange(true, peerCount);
    }
    this.notifyPlayersChange();
  }

  private notifyPlayersChange(): void {
    const players: Player[] = [this.player];
    
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId !== this.doc.clientID) {
        const awarenessState = state as AwarenessState;
        if (awarenessState.player) {
          players.push(awarenessState.player);
        }
      }
    });

    // Add connected peers without awareness
    this.connectedPeers.forEach((peerId) => {
      if (!players.find(p => p.id === peerId)) {
        players.push({
          id: peerId,
          name: `Player`,
          color: generatePlayerColor(),
          joinedAt: Date.now(),
          isHost: false,
        });
      }
    });

    if (this.options.onPlayersChange) {
      this.options.onPlayersChange(players);
    }
  }

  dispatchAction(action: GameActionInput): void {
    if (this.destroyed) return;

    const fullAction = {
      ...action,
      timestamp: Date.now(),
      playerId: this.peerId,
    } as GameAction;

    this.operationsArray.push([fullAction]);

    const update = Y.encodeStateAsUpdate(this.doc);
    this.dataChannels.forEach((channel) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify({ type: 'update', data: Array.from(update) }));
      }
    });
  }

  updateAwareness(update: Partial<AwarenessState>): void {
    if (this.destroyed) return;

    const currentState = this.awareness.getLocalState() as AwarenessState || {};
    this.awareness.setLocalState({
      ...currentState,
      ...update,
      player: this.player,
    });
  }

  getMeta(key: string): unknown {
    return this.metaMap.get(key);
  }

  setMeta(key: string, value: unknown): void {
    this.metaMap.set(key, value);
  }
  
  updateGameState(state: unknown): void {
    this.initialGameState = state;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.dataChannels.clear();

    this.awareness.destroy();
    this.doc.destroy();
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
