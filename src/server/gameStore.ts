import { CivGameState } from '@/games/civ/types';
import { createInitialGameState } from '@/lib/civ/mapGenerator';

// In-memory game store (for MVP — would use DB in production)
const games = new Map<string, CivGameState>();

export type SubscriberCallback = (state: CivGameState, event: string, metadata?: Record<string, string>) => void;

const subscribers = new Map<string, Set<SubscriberCallback>>();

export function getGame(id: string): CivGameState | undefined {
  return games.get(id);
}

export function createGame(seed: number, maxTurns: number = 20, mapSize: number = 30): CivGameState {
  const state = createInitialGameState(seed, mapSize, maxTurns);
  games.set(state.id, state);
  return state;
}

export function updateGame(state: CivGameState, event: string = 'state_update'): void {
  games.set(state.id, state);
  notifySubscribers(state.id, state, event);
}

/** Emit a lightweight event (e.g. thought chunks) without updating game state */
export function emitEvent(gameId: string, event: string, metadata?: Record<string, string>): void {
  const state = games.get(gameId);
  if (!state) return;
  notifySubscribers(gameId, state, event, metadata);
}

export function subscribe(gameId: string, callback: SubscriberCallback): () => void {
  if (!subscribers.has(gameId)) {
    subscribers.set(gameId, new Set());
  }
  subscribers.get(gameId)!.add(callback);

  return () => {
    subscribers.get(gameId)?.delete(callback);
  };
}

function notifySubscribers(gameId: string, state: CivGameState, event: string, metadata?: Record<string, string>): void {
  const subs = subscribers.get(gameId);
  if (subs) {
    for (const cb of subs) {
      try { cb(state, event, metadata); } catch {}
    }
  }
}
