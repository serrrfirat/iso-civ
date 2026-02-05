'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { CivGameState, CivId } from '@/games/civ/types';
import { createInitialGameState } from '@/lib/civ/mapGenerator';

interface ViewportState {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
}

interface CivGameContextValue {
  state: CivGameState;
  stateRef: React.RefObject<CivGameState>;
  setState: React.Dispatch<React.SetStateAction<CivGameState>>;
  perspective: CivId | 'global';
  setPerspective: (p: CivId | 'global') => void;
  autoAdvance: boolean;
  setAutoAdvance: (a: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
  selectedCityId: string | null;
  setSelectedCityId: (id: string | null) => void;
  isAdvancing: boolean;
  setIsAdvancing: (a: boolean) => void;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  panToGrid: (gridX: number, gridY: number) => void;
  setPanToGrid: (fn: (gridX: number, gridY: number) => void) => void;
}

const CivGameCtx = createContext<CivGameContextValue | null>(null);

export function CivGameProvider({ children, initialState }: { children: React.ReactNode; initialState?: CivGameState }) {
  const [state, setState] = useState<CivGameState>(() => initialState ?? createInitialGameState(Date.now()));
  const stateRef = useRef(state);
  stateRef.current = state;

  const [perspective, setPerspective] = useState<CivId | 'global'>('global');
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [viewport, setViewport] = useState<ViewportState>({
    offset: { x: 500, y: 100 },
    zoom: 0.8,
    canvasSize: { width: 0, height: 0 },
  });
  const [panToGridFn, setPanToGridFn] = useState<(gridX: number, gridY: number) => void>(() => () => {});

  const panToGrid = useCallback((gridX: number, gridY: number) => {
    panToGridFn(gridX, gridY);
  }, [panToGridFn]);

  const setPanToGrid = useCallback((fn: (gridX: number, gridY: number) => void) => {
    setPanToGridFn(() => fn);
  }, []);

  // SSE connection for real-time state updates
  useEffect(() => {
    if (!state.id) return;

    const es = new EventSource(`/api/game/${state.id}/stream`);

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'turn_complete') {
          setIsAdvancing(false);
        }

        if (msg.data) {
          setState(msg.data);
        }
      } catch {}
    };

    return () => {
      es.close();
    };
  }, [state.id]);

  return (
    <CivGameCtx.Provider value={{
      state, stateRef, setState, perspective, setPerspective,
      autoAdvance, setAutoAdvance, speed, setSpeed,
      selectedCityId, setSelectedCityId,
      isAdvancing, setIsAdvancing,
      viewport, setViewport, panToGrid, setPanToGrid,
    }}>
      {children}
    </CivGameCtx.Provider>
  );
}

export function useCivGame(): CivGameContextValue {
  const ctx = useContext(CivGameCtx);
  if (!ctx) throw new Error('useCivGame must be used within CivGameProvider');
  return ctx;
}
