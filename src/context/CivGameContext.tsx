'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { CivGameState, CivId } from '@/games/civ/types';
import { createInitialGameState } from '@/lib/civ/mapGenerator';

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
}

const CivGameCtx = createContext<CivGameContextValue | null>(null);

export function CivGameProvider({ children, initialState }: { children: React.ReactNode; initialState?: CivGameState }) {
  const [state, setState] = useState<CivGameState>(() => initialState ?? createInitialGameState(Date.now()));
  const stateRef = useRef(state);
  stateRef.current = state;

  const [perspective, setPerspective] = useState<CivId | 'global'>('global');
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [speed, setSpeed] = useState(1);

  return (
    <CivGameCtx.Provider value={{ state, stateRef, setState, perspective, setPerspective, autoAdvance, setAutoAdvance, speed, setSpeed }}>
      {children}
    </CivGameCtx.Provider>
  );
}

export function useCivGame(): CivGameContextValue {
  const ctx = useContext(CivGameCtx);
  if (!ctx) throw new Error('useCivGame must be used within CivGameProvider');
  return ctx;
}
