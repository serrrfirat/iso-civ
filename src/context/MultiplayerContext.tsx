'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  MultiplayerProvider,
  createMultiplayerProvider,
} from '@/lib/multiplayer/supabaseProvider';
import {
  GameAction,
  GameActionInput,
  Player,
  ConnectionState,
  PlayerRole,
  RoomData,
} from '@/lib/multiplayer/types';
import { GameState } from '@/types/game';

// Generate a random 5-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface MultiplayerContextValue {
  // Connection state
  connectionState: ConnectionState;
  role: PlayerRole;
  roomCode: string | null;
  players: Player[];
  error: string | null;

  // Actions
  createRoom: (cityName: string, playerName: string, initialState: GameState) => Promise<string>;
  joinRoom: (roomCode: string, playerName: string) => Promise<RoomData>;
  leaveRoom: () => void;
  
  // Game action dispatch
  dispatchAction: (action: GameActionInput) => void;
  
  // Initial state for guests
  initialState: GameState | null;
  
  // Callback for when remote actions are received
  onRemoteAction: ((action: GameAction) => void) | null;
  setOnRemoteAction: (callback: ((action: GameAction) => void) | null) => void;
  
  // Is this player the host?
  isHost: boolean;
  
  // Update the game state that will be sent to new peers (host only)
  updateGameState: (state: GameState) => void;
  
  // Provider instance (for advanced usage)
  provider: MultiplayerProvider | null;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function MultiplayerContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [role, setRole] = useState<PlayerRole>('solo');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<GameState | null>(null);
  
  const providerRef = useRef<MultiplayerProvider | null>(null);
  const onRemoteActionRef = useRef<((action: GameAction) => void) | null>(null);

  // Set up remote action callback
  const setOnRemoteAction = useCallback(
    (callback: ((action: GameAction) => void) | null) => {
      onRemoteActionRef.current = callback;
    },
    []
  );

  // Create a room as host
  const createRoom = useCallback(
    async (cityName: string, playerName: string, gameState: GameState): Promise<string> => {
      setConnectionState('connecting');
      setError(null);

      try {
        // Generate room code (no API needed - Supabase channels are created on-demand)
        const newRoomCode = generateRoomCode();

        // Create multiplayer provider
        const provider = await createMultiplayerProvider({
          roomCode: newRoomCode,
          cityName,
          playerName,
          isHost: true,
          initialGameState: gameState,
          onConnectionChange: (connected, peerCount) => {
            setConnectionState(connected ? 'connected' : 'disconnected');
          },
          onPlayersChange: (newPlayers) => {
            setPlayers(newPlayers);
          },
          onAction: (action) => {
            if (onRemoteActionRef.current) {
              onRemoteActionRef.current(action);
            }
          },
        });

        providerRef.current = provider;
        setRoomCode(newRoomCode);
        setRole('host');
        setConnectionState('connected');

        return newRoomCode;
      } catch (err) {
        setConnectionState('error');
        setError(err instanceof Error ? err.message : 'Failed to create room');
        throw err;
      }
    },
    []
  );

  // Join an existing room as guest
  const joinRoom = useCallback(
    async (code: string, playerName: string): Promise<RoomData> => {
      setConnectionState('connecting');
      setError(null);

      try {
        const normalizedCode = code.toUpperCase();
        
        // Create multiplayer provider as guest
        // Supabase channels work directly - no need to verify room exists
        const provider = await createMultiplayerProvider({
          roomCode: normalizedCode,
          cityName: 'Co-op City',
          playerName,
          isHost: false,
          onConnectionChange: (connected, peerCount) => {
            setConnectionState(connected ? 'connected' : 'disconnected');
          },
          onPlayersChange: (newPlayers) => {
            setPlayers(newPlayers);
          },
          onAction: (action) => {
            if (onRemoteActionRef.current) {
              onRemoteActionRef.current(action);
            }
          },
          onStateReceived: (state) => {
            setInitialState(state as GameState);
          },
        });

        providerRef.current = provider;
        setRoomCode(normalizedCode);
        setRole('guest');
        setConnectionState('connected');

        // Return room data
        const room: RoomData = {
          code: normalizedCode,
          hostId: '',
          cityName: 'Co-op City',
          createdAt: Date.now(),
          playerCount: 1,
        };

        return room;
      } catch (err) {
        setConnectionState('error');
        setError(err instanceof Error ? err.message : 'Failed to join room');
        throw err;
      }
    },
    []
  );

  // Leave the current room
  const leaveRoom = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }

    setConnectionState('disconnected');
    setRole('solo');
    setRoomCode(null);
    setPlayers([]);
    setError(null);
    setInitialState(null);
  }, []);

  // Dispatch a game action to all peers
  const dispatchAction = useCallback(
    (action: GameActionInput) => {
      if (providerRef.current) {
        providerRef.current.dispatchAction(action);
      }
    },
    []
  );

  // Update the game state that will be sent to new peers (host only)
  const updateGameState = useCallback(
    (state: GameState) => {
      if (providerRef.current && role === 'host') {
        providerRef.current.updateGameState(state);
      }
    },
    [role]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
  }, []);

  const value: MultiplayerContextValue = {
    connectionState,
    role,
    roomCode,
    players,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    dispatchAction,
    initialState,
    onRemoteAction: onRemoteActionRef.current,
    setOnRemoteAction,
    isHost: role === 'host',
    updateGameState,
    provider: providerRef.current,
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within a MultiplayerContextProvider');
  }
  return context;
}

// Optional hook that returns null if not in multiplayer context
export function useMultiplayerOptional() {
  return useContext(MultiplayerContext);
}
