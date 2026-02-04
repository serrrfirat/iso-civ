'use client';

import React from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CivCanvas } from '@/components/civ/CivCanvas';
import { DiplomacyFeed } from './DiplomacyFeed';
import { CivPanel } from './CivPanel';
import { NarratorOverlay } from './NarratorOverlay';
import { TurnIndicator } from './TurnIndicator';
import { GameControls } from './GameControls';
import { CivId } from '@/games/civ/types';

export function SpectatorView() {
  const { state } = useCivGame();
  const civIds: CivId[] = ['rome', 'egypt', 'mongolia'];

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0">
        <TurnIndicator />
        <div className="text-gray-400 text-sm font-bold tracking-wider">AGENT CIVILIZATION</div>
        <GameControls />
      </div>

      {/* Main content: map + diplomacy sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Map area (60%) */}
        <div className="relative flex-[3] min-w-0">
          <CivCanvas />
          <NarratorOverlay />
        </div>

        {/* Diplomacy sidebar (40%) */}
        <div className="flex-[2] min-w-[320px] max-w-[480px] border-l border-gray-700 bg-gray-900 flex flex-col">
          <div className="px-4 py-2 border-b border-gray-700 text-sm font-bold text-gray-300 tracking-wider">
            DIPLOMACY
          </div>
          <DiplomacyFeed />
        </div>
      </div>

      {/* Bottom panels */}
      <div className="flex border-t border-gray-700 bg-gray-900 shrink-0">
        {civIds.map(civId => (
          <CivPanel key={civId} civId={civId} />
        ))}
        {/* Narrator summary */}
        <div className="flex-1 px-4 py-3 border-l border-gray-700">
          <div className="text-xs text-gray-500 font-bold mb-1">NARRATOR</div>
          <div className="text-sm text-gray-300 italic line-clamp-3">
            {state.currentNarration || 'Awaiting events...'}
          </div>
        </div>
      </div>
    </div>
  );
}
