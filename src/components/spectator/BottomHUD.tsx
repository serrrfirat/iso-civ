'use client';

import React, { useCallback } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS } from '@/games/civ/types';
import { Minimap } from './Minimap';
import {
  DiplomacyIcon,
  TechIcon,
  CitiesIcon,
  UnitsIcon,
  EventsIcon,
  CultureHudIcon,
  WorldTrackerIcon,
} from './HudIcons';

// ---- Reused utilities from TopBar ----

const PHASE_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  idle: { label: 'IDLE', color: 'text-gray-400', dot: '#9ca3af' },
  diplomacy: { label: 'DIPLOMACY', color: 'text-purple-400', dot: '#c084fc' },
  planning: { label: 'PLANNING', color: 'text-blue-400', dot: '#60a5fa' },
  resolution: { label: 'RESOLUTION', color: 'text-orange-400', dot: '#fb923c' },
  narration: { label: 'NARRATION', color: 'text-green-400', dot: '#4ade80' },
};

function getTurnEra(turn: number, maxTurns: number): { year: string; era: string } {
  const progress = turn / maxTurns;
  if (progress < 0.15) {
    const year = 4000 - Math.floor(turn * 40);
    return { year: `${year} BC`, era: 'Ancient Era' };
  } else if (progress < 0.30) {
    const year = 1000 - Math.floor((turn - maxTurns * 0.15) * 20);
    return { year: year > 0 ? `${year} BC` : `${Math.abs(year)} AD`, era: 'Classical Era' };
  } else if (progress < 0.45) {
    const year = Math.floor((turn - maxTurns * 0.30) * 15) + 400;
    return { year: `${year} AD`, era: 'Medieval Era' };
  } else if (progress < 0.60) {
    const year = Math.floor((turn - maxTurns * 0.45) * 10) + 1200;
    return { year: `${year} AD`, era: 'Renaissance Era' };
  } else if (progress < 0.75) {
    const year = Math.floor((turn - maxTurns * 0.60) * 8) + 1600;
    return { year: `${year} AD`, era: 'Industrial Era' };
  } else if (progress < 0.90) {
    const year = Math.floor((turn - maxTurns * 0.75) * 6) + 1850;
    return { year: `${year} AD`, era: 'Modern Era' };
  } else {
    const year = Math.floor((turn - maxTurns * 0.90) * 5) + 1950;
    return { year: `${Math.min(year, 2100)} AD`, era: 'Information Era' };
  }
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return value.toFixed(1);
}

// SVG icons for resources (compact versions)
const ScienceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M7 2v2h1v6.17a5 5 0 1 0 8 0V4h1V2H7zm5 18a3 3 0 0 1-2.83-4h5.66A3 3 0 0 1 12 20zm2-6H10V4h4v10z" />
  </svg>
);

const GoldIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" fill="none" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">$</text>
  </svg>
);

const CultureResIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);

const ProductionResIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M12.5 2L2 7v10l10.5 5 10.5-5V7l-10.5-5zm-1 15.75L4 14.31V9.44l7.5 3.75v5.56zm1-7.5L5.23 6.5 12.5 3l7.27 3.5L12.5 10.25zm8 4.56l-7.5 3.75v-5.56l7.5-3.75v5.56z" />
  </svg>
);

// ---- Overlay panel config ----

export type OverlayId = 'diplomacy' | 'techtree' | 'cities' | 'units' | 'events' | 'culture' | 'worldtracker';

const OVERLAY_CONFIG: Array<{
  id: OverlayId;
  label: string;
  icon: React.ReactNode;
  accentColor: string;
}> = [
  { id: 'diplomacy', label: 'Diplomacy', icon: <DiplomacyIcon className="w-4 h-4" />, accentColor: '#3b82f6' },
  { id: 'techtree', label: 'Tech Tree', icon: <TechIcon className="w-4 h-4" />, accentColor: '#10b981' },
  { id: 'cities', label: 'Cities', icon: <CitiesIcon className="w-4 h-4" />, accentColor: '#f59e0b' },
  { id: 'units', label: 'Units', icon: <UnitsIcon className="w-4 h-4" />, accentColor: '#ef4444' },
  { id: 'events', label: 'Events', icon: <EventsIcon className="w-4 h-4" />, accentColor: '#a855f7' },
  { id: 'culture', label: 'Culture', icon: <CultureHudIcon className="w-4 h-4" />, accentColor: '#8b5cf6' },
  { id: 'worldtracker', label: 'Tracker', icon: <WorldTrackerIcon className="w-4 h-4" />, accentColor: '#14b8a6' },
];

// ---- Component ----

interface BottomHUDProps {
  activeOverlay: OverlayId | null;
  onToggleOverlay: (id: OverlayId) => void;
}

export function BottomHUD({ activeOverlay, onToggleOverlay }: BottomHUDProps) {
  const {
    state,
    perspective,
    setPerspective,
    autoAdvance,
    setAutoAdvance,
    speed,
    setSpeed,
    setState,
    isAdvancing,
    setIsAdvancing,
    viewport,
    panToGrid,
    isReplaying,
    autoReplay,
    setAutoReplay,
  } = useCivGame();

  const phaseInfo = PHASE_LABELS[state.phase] || PHASE_LABELS.idle;
  const { year, era } = getTurnEra(state.turn, state.maxTurns);

  // Calculate total yields
  const totalYields = Object.values(state.civilizations).reduce(
    (acc, civ) => {
      if (!civ.isAlive) return acc;
      const civCities = civ.cities.map(id => state.cities[id]).filter(Boolean);
      const cityYields = civCities.reduce(
        (ca, city) => ({
          science: ca.science + (city?.sciencePerTurn || 0),
          gold: ca.gold + (city?.goldPerTurn || 0),
          culture: ca.culture + (city?.culturePerTurn || 0),
          production: ca.production + (city?.productionPerTurn || 0),
        }),
        { science: 0, gold: 0, culture: 0, production: 0 }
      );
      return {
        science: acc.science + cityYields.science,
        gold: acc.gold + cityYields.gold,
        culture: acc.culture + cityYields.culture,
        production: acc.production + cityYields.production,
      };
    },
    { science: 0, gold: 0, culture: 0, production: 0 }
  );

  const civIds = Object.keys(state.civilizations);

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
      setState(prev => ({ ...prev, turn: prev.turn + 1, phase: 'idle' }));
    } finally {
      setIsAdvancing(false);
    }
  }, [state.id, setState, isAdvancing, setIsAdvancing]);

  return (
    <div
      className="h-[80px] flex items-center shrink-0 select-none"
      style={{
        background: 'linear-gradient(180deg, #0d1b2a 0%, #0a1628 50%, #060e1a 100%)',
        borderTop: '2px solid',
        borderImage: 'linear-gradient(90deg, #8B6914 0%, #D4AF37 25%, #F5D442 50%, #D4AF37 75%, #8B6914 100%) 1',
      }}
    >
      {/* 1. Minimap */}
      <div className="w-[100px] h-full flex items-center justify-center px-2 shrink-0">
        <div className="border border-amber-600/50 rounded-sm overflow-hidden">
          <Minimap
            viewportOffset={viewport.offset}
            viewportZoom={viewport.zoom}
            canvasSize={viewport.canvasSize}
            onPanTo={panToGrid}
            size={72}
            standalone={false}
          />
        </div>
      </div>

      <div className="w-px h-12 bg-amber-700/30 shrink-0" />

      {/* 2. Civ Pips */}
      <div className="flex items-center gap-1.5 px-3 shrink-0">
        {/* Globe for global view */}
        <button
          onClick={() => setPerspective('global')}
          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
            perspective === 'global'
              ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900'
              : 'opacity-60 hover:opacity-100'
          }`}
          style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}
          title="Global View"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1">
            <circle cx="12" cy="12" r="10" fill="none" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" />
          </svg>
        </button>

        {civIds.map(civId => {
          const colors = CIV_COLORS[civId];
          const civ = state.civilizations[civId];
          if (!civ) return null;
          return (
            <button
              key={civId}
              onClick={() => setPerspective(civId)}
              className={`w-4 h-4 rounded-full transition-all ${
                perspective === civId
                  ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900 scale-110'
                  : civ.isAlive ? 'opacity-60 hover:opacity-100' : 'opacity-25'
              }`}
              style={{ backgroundColor: colors?.primary ?? '#888' }}
              title={`${colors?.label ?? civId}${!civ.isAlive ? ' (Eliminated)' : ''}`}
            />
          );
        })}
      </div>

      <div className="w-px h-12 bg-amber-700/30 shrink-0" />

      {/* 3. Status Center */}
      <div className="flex-1 flex items-center justify-center gap-4 px-4 min-w-0">
        {/* Phase indicator */}
        <div className="flex items-center gap-1.5">
          {state.phase !== 'idle' && (
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: phaseInfo.dot }}
            />
          )}
          <span className={`text-[10px] font-bold tracking-wider ${phaseInfo.color}`}>
            {phaseInfo.label}
          </span>
        </div>

        <div className="w-px h-6 bg-gray-700/40" />

        {/* Era + Year */}
        <div className="text-center">
          <div className="text-[9px] text-gray-500 font-medium tracking-wide uppercase leading-tight">
            {era}
          </div>
          <div className="text-xs text-amber-200 font-bold tracking-wide leading-tight">
            {year}
          </div>
        </div>

        <div className="w-px h-6 bg-gray-700/40" />

        {/* Turn counter */}
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] text-gray-500 font-bold tracking-wider">TURN</span>
          <span className="text-lg text-white font-bold leading-none">{state.turn}</span>
          <span className="text-xs text-gray-600 font-bold">/{state.maxTurns}</span>
        </div>

        <div className="w-px h-6 bg-gray-700/40" />

        {/* Resource yields */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5" title="Science per turn">
            <span style={{ color: '#5BC0EB' }}><ScienceIcon /></span>
            <span className="text-[11px] font-bold text-emerald-400">+{formatValue(totalYields.science)}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Gold per turn">
            <span style={{ color: '#FFD700' }}><GoldIcon /></span>
            <span className="text-[11px] font-bold text-emerald-400">+{formatValue(totalYields.gold)}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Culture per turn">
            <span style={{ color: '#9B59B6' }}><CultureResIcon /></span>
            <span className="text-[11px] font-bold text-emerald-400">+{formatValue(totalYields.culture)}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Production per turn">
            <span style={{ color: '#E67E22' }}><ProductionResIcon /></span>
            <span className="text-[11px] font-bold text-emerald-400">+{formatValue(totalYields.production)}</span>
          </div>
        </div>

        {/* Victory notice */}
        {state.winner && (
          <>
            <div className="w-px h-6 bg-gray-700/40" />
            <div className="text-yellow-400 font-bold text-xs animate-pulse">
              VICTORY: {state.civilizations[state.winner]?.name}
            </div>
          </>
        )}
      </div>

      <div className="w-px h-12 bg-amber-700/30 shrink-0" />

      {/* 4. Panel Icons */}
      <div className="flex items-center gap-1 px-3 shrink-0">
        {OVERLAY_CONFIG.map(cfg => {
          const isActive = activeOverlay === cfg.id;
          return (
            <button
              key={cfg.id}
              onClick={() => onToggleOverlay(cfg.id)}
              className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-white/10'
                  : 'hover:bg-white/5 opacity-60 hover:opacity-100'
              }`}
              style={isActive ? {
                color: cfg.accentColor,
                boxShadow: `0 0 8px ${cfg.accentColor}40, inset 0 0 4px ${cfg.accentColor}20`,
              } : {
                color: '#9ca3af',
              }}
              title={cfg.label}
            >
              {cfg.icon}
            </button>
          );
        })}
      </div>

      <div className="w-px h-12 bg-amber-700/30 shrink-0" />

      {/* 5. Turn Controls */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        {/* NEXT button */}
        <button
          onClick={handleAdvanceTurn}
          disabled={state.winner !== null || isAdvancing || isReplaying}
          className={`
            w-12 h-12 rounded-full font-bold text-[10px] transition-all duration-200
            flex flex-col items-center justify-center gap-0.5
            border-2 shadow-lg
            ${isAdvancing || isReplaying
              ? 'bg-slate-700 border-slate-600 text-slate-400 cursor-wait'
              : state.winner
                ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-b from-amber-600 to-amber-700 border-amber-500 text-white hover:from-amber-500 hover:to-amber-600 hover:border-amber-400 hover:scale-105 active:scale-95'
            }
          `}
        >
          {isAdvancing || isReplaying ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>NEXT</span>
            </>
          )}
        </button>

        {/* Speed + Auto */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-0.5">
            {[1, 2, 5].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                  speed === s
                    ? 'bg-amber-700/60 text-amber-200 border border-amber-500/50'
                    : 'text-gray-500 hover:text-gray-300 bg-slate-800/50 border border-slate-700/50'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
          <button
            onClick={() => setAutoAdvance(!autoAdvance)}
            className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
              autoAdvance
                ? 'bg-green-700/60 text-green-200 border border-green-500/50'
                : 'text-gray-500 hover:text-gray-300 bg-slate-800/50 border border-slate-700/50'
            }`}
          >
            {autoAdvance ? 'AUTO ON' : 'AUTO'}
          </button>
          <button
            onClick={() => setAutoReplay(!autoReplay)}
            className={`text-[9px] px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
              autoReplay
                ? 'bg-purple-700/60 text-purple-200 border border-purple-500/50'
                : 'text-gray-500 hover:text-gray-300 bg-slate-800/50 border border-slate-700/50'
            }`}
            title="Auto-replay turn events after each turn"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            {autoReplay ? 'REPLAY' : 'REPLAY'}
          </button>
        </div>
      </div>
    </div>
  );
}
