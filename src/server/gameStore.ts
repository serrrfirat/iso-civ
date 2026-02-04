import { CivGameState } from '@/games/civ/types';
import { createInitialGameState } from '@/lib/civ/mapGenerator';

// In-memory game store (for MVP — would use DB in production)
const games = new Map<string, CivGameState>();
const subscribers = new Map<string, Set<(state: CivGameState, event: string) => void>>();

export function getGame(id: string): CivGameState | undefined {
  return games.get(id);
}

export function createGame(seed: number, maxTurns: number = 20): CivGameState {
  const state = createInitialGameState(seed, 30, maxTurns);
  games.set(state.id, state);
  return state;
}

export function updateGame(state: CivGameState): void {
  games.set(state.id, state);
  notifySubscribers(state.id, state, 'state_update');
}

export function subscribe(gameId: string, callback: (state: CivGameState, event: string) => void): () => void {
  if (!subscribers.has(gameId)) {
    subscribers.set(gameId, new Set());
  }
  subscribers.get(gameId)!.add(callback);

  return () => {
    subscribers.get(gameId)?.delete(callback);
  };
}

function notifySubscribers(gameId: string, state: CivGameState, event: string): void {
  const subs = subscribers.get(gameId);
  if (subs) {
    for (const cb of subs) {
      try { cb(state, event); } catch {}
    }
  }
}
