'use client';

import React, { useCallback } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS } from '@/games/civ/types';

export function GameControls() {
  const { perspective, setPerspective, autoAdvance, setAutoAdvance, speed, setSpeed, state, setState, isAdvancing, setIsAdvancing } = useCivGame();

  const perspectives: Array<{ id: string; label: string; color?: string }> = [
    { id: 'global', label: 'Global' },
    ...Object.keys(state.civilizations).map(civId => ({
      id: civId,
      label: CIV_COLORS[civId]?.label ?? civId,
      color: CIV_COLORS[civId]?.primary,
    })),
  ];

  const handleAdvanceTurn = useCallback(async () => {
    if (isAdvancing) return;
    setIsAdvancing(true);

    try {
      const res = await fetch(`/api/game/${state.id}/advance`, { method: 'POST' });
      if (res.ok) {
        const newState = await res.json();
        setState(newState);
      }
    } catch {
      // If API not available, do a local stub advance
      setState(prev => ({
        ...prev,
        turn: prev.turn + 1,
        phase: 'idle',
      }));
    } finally {
      setIsAdvancing(false);
    }
  }, [state.id, setState, isAdvancing, setIsAdvancing]);

  return (
    <div className="flex items-center gap-3">
      {/* Perspective selector */}
      <div className="flex items-center gap-1">
        {perspectives.map(p => (
          <button
            key={p.id}
            onClick={() => setPerspective(p.id)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              perspective === p.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
            style={perspective === p.id && p.color ? { borderColor: p.color, borderWidth: '1px', borderStyle: 'solid' } : undefined}
          >
            {p.color && <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: p.color }} />}
            {p.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Speed control */}
      <div className="flex items-center gap-1">
        {[1, 2, 5].map(s => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`text-xs px-1.5 py-0.5 rounded ${speed === s ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Turn advance */}
      <button
        onClick={handleAdvanceTurn}
        disabled={state.winner !== null || isAdvancing}
        className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-bold transition-colors flex items-center gap-1.5"
      >
        {isAdvancing && (
          <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {isAdvancing ? 'Processing...' : 'Next Turn'}
      </button>

      {/* Auto-advance toggle */}
      <button
        onClick={() => setAutoAdvance(!autoAdvance)}
        className={`text-xs px-2 py-1 rounded transition-colors ${
          autoAdvance ? 'bg-green-700 text-green-200' : 'text-gray-500 hover:text-gray-300 bg-gray-800'
        }`}
      >
        {autoAdvance ? 'Auto: ON' : 'Auto: OFF'}
      </button>
    </div>
  );
}
