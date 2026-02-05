'use client';

import React, { useCallback } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, City } from '@/games/civ/types';
import { ruleset } from '@/lib/civ/ruleset';
import { Minimap } from './Minimap';

// =========================================================================
// CITY DETAIL PANEL - Shows selected city info in Civ 6 style
// =========================================================================

interface CityDetailInlineProps {
  city: City;
  onClose: () => void;
}

function CityDetailInline({ city, onClose }: CityDetailInlineProps) {
  const civColors = CIV_COLORS[city.ownerId];
  const primaryColor = civColors?.primary ?? '#888888';

  // Get production target name
  const getProductionTargetName = (type: 'unit' | 'building', target: string): string => {
    if (type === 'unit') {
      const u = ruleset.getUnit(target);
      return u?.name ?? target;
    }
    const b = ruleset.getBuilding(target);
    return b?.name ?? target;
  };

  const productionPct = city.currentProduction
    ? Math.min((city.currentProduction.progress / city.currentProduction.cost) * 100, 100)
    : 0;

  return (
    <div className="h-full flex flex-col bg-slate-900/95 border-l-2 border-amber-600/40">
      {/* City Header */}
      <div
        className="px-3 py-2 border-b border-amber-700/30 flex items-center justify-between"
        style={{ borderTopColor: primaryColor, borderTopWidth: '2px' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          />
          <h3 className="text-sm font-bold text-amber-100 truncate">{city.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-amber-300 transition-colors p-0.5 rounded hover:bg-amber-900/30 flex-shrink-0"
          aria-label="Close city panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="p-3 flex-1 overflow-y-auto">
        {/* Population & Defense Row */}
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-blue-900/60 flex items-center justify-center">
              <span className="text-[10px] text-blue-300">P</span>
            </div>
            <span className="text-sm font-bold text-white">{city.population}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-700/60 flex items-center justify-center">
              <span className="text-[10px] text-gray-300">D</span>
            </div>
            <span className="text-sm font-bold text-white">{city.defense}</span>
          </div>
        </div>

        {/* Yields Grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="flex items-center gap-1 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-700/30">
            <span className="text-yellow-400 text-[10px] font-bold">G</span>
            <span className="text-xs text-yellow-200">+{city.goldPerTurn}</span>
          </div>
          <div className="flex items-center gap-1 bg-green-900/20 px-2 py-1 rounded border border-green-700/30">
            <span className="text-green-400 text-[10px] font-bold">F</span>
            <span className="text-xs text-green-200">+{city.foodPerTurn}</span>
          </div>
          <div className="flex items-center gap-1 bg-orange-900/20 px-2 py-1 rounded border border-orange-700/30">
            <span className="text-orange-400 text-[10px] font-bold">P</span>
            <span className="text-xs text-orange-200">+{city.productionPerTurn}</span>
          </div>
          <div className="flex items-center gap-1 bg-blue-900/20 px-2 py-1 rounded border border-blue-700/30">
            <span className="text-blue-400 text-[10px] font-bold">S</span>
            <span className="text-xs text-blue-200">+{city.sciencePerTurn}</span>
          </div>
          <div className="flex items-center gap-1 bg-purple-900/20 px-2 py-1 rounded border border-purple-700/30">
            <span className="text-purple-400 text-[10px] font-bold">C</span>
            <span className="text-xs text-purple-200">+{city.culturePerTurn}</span>
          </div>
        </div>

        {/* Production */}
        <div className="border-t border-amber-800/30 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-amber-600/80 font-bold mb-1.5">
            Production
          </div>
          {city.currentProduction ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-orange-300 font-semibold">
                  {getProductionTargetName(city.currentProduction.type, city.currentProduction.target)}
                </span>
                <span className="text-[10px] text-gray-500">
                  {city.currentProduction.progress}/{city.currentProduction.cost}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-amber-700/30">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-300"
                  style={{ width: `${productionPct}%` }}
                />
              </div>
            </div>
          ) : (
            <button className="w-full py-1.5 px-3 bg-orange-700/40 hover:bg-orange-600/50 border border-orange-500/50 rounded text-xs text-orange-200 font-bold transition-colors">
              CHOOSE PRODUCTION
            </button>
          )}
        </div>

        {/* Buildings count */}
        {city.buildings.length > 0 && (
          <div className="mt-2 pt-2 border-t border-amber-800/30">
            <div className="text-[10px] text-gray-500">
              {city.buildings.length} building{city.buildings.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// GAME CONTROLS - Next Turn, Speed, Perspective in Civ 6 style
// =========================================================================

function GameControlsInline() {
  const {
    perspective, setPerspective,
    autoAdvance, setAutoAdvance,
    speed, setSpeed,
    state, setState,
    isAdvancing, setIsAdvancing
  } = useCivGame();

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
    <div className="flex flex-col items-center gap-2 h-full justify-center py-2">
      {/* Next Turn Button - Prominent circular style like Civ 6 */}
      <button
        onClick={handleAdvanceTurn}
        disabled={state.winner !== null || isAdvancing}
        className={`
          w-16 h-16 rounded-full font-bold text-xs transition-all duration-200
          flex flex-col items-center justify-center gap-0.5
          border-2 shadow-lg
          ${isAdvancing
            ? 'bg-slate-700 border-slate-600 text-slate-400 cursor-wait'
            : state.winner
              ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-b from-amber-600 to-amber-700 border-amber-500 text-white hover:from-amber-500 hover:to-amber-600 hover:border-amber-400 hover:scale-105 active:scale-95'
          }
        `}
      >
        {isAdvancing ? (
          <>
            <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-[10px]">NEXT</span>
          </>
        )}
      </button>

      {/* Speed & Auto Controls */}
      <div className="flex items-center gap-1">
        {[1, 2, 5].map(s => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              speed === s
                ? 'bg-amber-700/60 text-amber-200 border border-amber-500/50'
                : 'text-gray-500 hover:text-gray-300 bg-slate-800/50 border border-slate-700/50'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Auto-advance toggle */}
      <button
        onClick={() => setAutoAdvance(!autoAdvance)}
        className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
          autoAdvance
            ? 'bg-green-700/60 text-green-200 border border-green-500/50'
            : 'text-gray-500 hover:text-gray-300 bg-slate-800/50 border border-slate-700/50'
        }`}
      >
        {autoAdvance ? 'AUTO ON' : 'AUTO'}
      </button>

      {/* Perspective Selector - Compact */}
      <div className="flex flex-wrap justify-center gap-1 mt-1">
        {perspectives.map(p => (
          <button
            key={p.id}
            onClick={() => setPerspective(p.id)}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5 ${
              perspective === p.id
                ? 'bg-slate-700 text-white border border-amber-500/50'
                : 'text-gray-500 hover:text-gray-300 hover:bg-slate-800/50'
            }`}
          >
            {p.color && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: p.color }}
              />
            )}
            <span className="max-w-[40px] truncate">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// MINIMAP WRAPPER - With ornate gold frame styling
// =========================================================================

interface MinimapFrameProps {
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  canvasSize: { width: number; height: number };
  onPanTo?: (gridX: number, gridY: number) => void;
}

function MinimapFrame({ viewportOffset, viewportZoom, canvasSize, onPanTo }: MinimapFrameProps) {
  return (
    <div className="relative h-full flex items-center justify-center">
      {/* Ornate outer frame */}
      <div className="relative">
        {/* Corner decorations */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/80" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/80" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/80" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/80" />

        {/* Main frame border */}
        <div className="border-2 border-amber-600/60 rounded-sm bg-slate-950/90 p-0.5">
          <div className="border border-amber-800/40 rounded-sm overflow-hidden">
            <Minimap
              viewportOffset={viewportOffset}
              viewportZoom={viewportZoom}
              canvasSize={canvasSize}
              onPanTo={onPanTo}
              size={140}
              standalone={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// MAIN BOTTOM BAR COMPONENT
// =========================================================================

export function BottomBar() {
  const {
    selectedCityId,
    setSelectedCityId,
    state,
    viewport,
    panToGrid
  } = useCivGame();

  const selectedCity = selectedCityId ? state.cities[selectedCityId] : null;

  return (
    <div className="h-[160px] flex bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-700/40 shrink-0">
      {/* Left Section - Minimap */}
      <div className="w-[200px] flex-shrink-0 p-2 border-r border-amber-800/30">
        <MinimapFrame
          viewportOffset={viewport.offset}
          viewportZoom={viewport.zoom}
          canvasSize={viewport.canvasSize}
          onPanTo={panToGrid}
        />
      </div>

      {/* Center Section - Game Controls */}
      <div className="flex-1 flex items-center justify-center px-4 border-r border-amber-800/30">
        <GameControlsInline />
      </div>

      {/* Right Section - Selected City/Unit Info */}
      <div className="w-[350px] flex-shrink-0">
        {selectedCity ? (
          <CityDetailInline
            city={selectedCity}
            onClose={() => setSelectedCityId(null)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 p-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-50">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="text-xs">Select a city to view details</span>
          </div>
        )}
      </div>
    </div>
  );
}
