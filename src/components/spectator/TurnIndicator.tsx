'use client';

import React from 'react';
import { useCivGame } from '@/context/CivGameContext';

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: 'IDLE', color: 'text-gray-500' },
  diplomacy: { label: 'DIPLOMACY', color: 'text-purple-400' },
  planning: { label: 'PLANNING', color: 'text-blue-400' },
  resolution: { label: 'RESOLUTION', color: 'text-orange-400' },
  narration: { label: 'NARRATION', color: 'text-green-400' },
};

export function TurnIndicator() {
  const { state } = useCivGame();
  const phaseInfo = PHASE_LABELS[state.phase] || PHASE_LABELS.idle;

  return (
    <div className="flex items-center gap-4">
      <div className="text-white font-bold text-sm">
        Turn <span className="text-lg">{state.turn}</span>
        <span className="text-gray-500">/{state.maxTurns}</span>
      </div>
      <div className={`text-xs font-bold tracking-wider ${phaseInfo.color}`}>
        {state.phase !== 'idle' && (
          <span className="inline-block w-2 h-2 rounded-full bg-current mr-1.5 animate-pulse" />
        )}
        {phaseInfo.label}
      </div>
      {state.winner && (
        <div className="text-yellow-400 font-bold text-sm">
          Winner: {state.civilizations[state.winner]?.name}
        </div>
      )}
    </div>
  );
}
