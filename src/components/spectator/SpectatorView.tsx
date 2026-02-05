'use client';

import React, { useState } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CivCanvas } from '@/components/civ/CivCanvas';
import { DiplomacyFeed } from './DiplomacyFeed';
import { TechTreePanel } from './TechTreePanel';
import { CivPanel } from './CivPanel';
import { NarratorOverlay } from './NarratorOverlay';
import { TurnIndicator } from './TurnIndicator';
import { GameControls } from './GameControls';
import { CityDetailPanel } from './CityDetailPanel';
import { CityListPanel } from './CityListPanel';
import { Minimap } from './Minimap';
import { UnitListPanel } from './UnitListPanel';
import { NotificationPanel } from './NotificationPanel';
import { TurnSummaryPanel } from './TurnSummaryPanel';

type SidebarTab = 'diplomacy' | 'techtree' | 'cities' | 'units' | 'events';

export function SpectatorView() {
  const { state, isAdvancing, viewport, panToGrid } = useCivGame();
  const civIds = Object.keys(state.civilizations);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('diplomacy');

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0">
        <TurnIndicator />
        <div className="text-gray-400 text-sm font-bold tracking-wider">AGENT CIVILIZATION</div>
        <GameControls />
      </div>

      {/* Main content: map + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Map area (60%) */}
        <div className="relative flex-[3] min-w-0">
          <CivCanvas />
          <Minimap
            viewportOffset={viewport.offset}
            viewportZoom={viewport.zoom}
            canvasSize={viewport.canvasSize}
            onPanTo={panToGrid}
          />
          <CityDetailPanel />
          <NotificationPanel />
          <NarratorOverlay />
          {/* Processing overlay */}
          {isAdvancing && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="bg-gray-950/80 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-4 flex items-center gap-3 shadow-2xl">
                <span className="inline-block w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                <span className="text-sm text-gray-300 font-medium">Civilizations are deciding their next moves...</span>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar (40%) */}
        <div className="flex-[2] min-w-[320px] max-w-[480px] border-l border-gray-700 bg-gray-900 flex flex-col">
          {/* Sidebar tab switcher */}
          <div className="flex border-b border-gray-700 shrink-0">
            <button
              onClick={() => setSidebarTab('diplomacy')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'diplomacy'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              DIPLOMACY
            </button>
            <button
              onClick={() => setSidebarTab('techtree')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'techtree'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              TECH TREE
            </button>
            <button
              onClick={() => setSidebarTab('cities')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'cities'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-amber-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              CITIES
            </button>
            <button
              onClick={() => setSidebarTab('units')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'units'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-red-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              UNITS
            </button>
            <button
              onClick={() => setSidebarTab('events')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'events'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-purple-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              EVENTS
            </button>
          </div>

          {/* Sidebar content */}
          {sidebarTab === 'diplomacy' && <DiplomacyFeed />}
          {sidebarTab === 'techtree' && <TechTreePanel />}
          {sidebarTab === 'cities' && <CityListPanel />}
          {sidebarTab === 'units' && <UnitListPanel />}
          {sidebarTab === 'events' && <TurnSummaryPanel />}
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
