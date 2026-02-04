'use client';

import { useEffect, useRef, useCallback } from 'react';
import { CivGameState } from '@/games/civ/types';

interface UseSpectatorStreamOptions {
  gameId: string;
  onStateUpdate: (state: CivGameState) => void;
  enabled?: boolean;
}

export function useSpectatorStream({ gameId, onStateUpdate, enabled = true }: UseSpectatorStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !gameId) return;

    const es = new EventSource(`/api/game/${gameId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.data) {
          onStateUpdate(payload.data);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };

    return () => es.close();
  }, [gameId, onStateUpdate, enabled]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      eventSourceRef.current?.close();
    };
  }, [connect]);
}
