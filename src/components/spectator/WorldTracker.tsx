'use client';

import React, { useState, useMemo } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, Civilization, City } from '@/games/civ/types';
import { ruleset } from '@/lib/civ/ruleset';

// ============================================================================
// Tech Icons (simple SVG representations)
// ============================================================================

function ResearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ProductionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ChevronIcon({ direction, className }: { direction: 'up' | 'down'; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform ${direction === 'up' ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ============================================================================
// Progress Bar Component
// ============================================================================

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  bgColor?: string;
  height?: string;
}

function ProgressBar({ progress, color = '#14b8a6', bgColor = '#1e293b', height = '4px' }: ProgressBarProps) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, backgroundColor: bgColor }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${Math.min(Math.max(progress, 0), 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

// ============================================================================
// Research Section
// ============================================================================

interface ResearchSectionProps {
  civ: Civilization;
  colors: { primary: string; secondary: string; label: string };
}

function ResearchSection({ civ, colors }: ResearchSectionProps) {
  if (!civ.currentResearch) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-xs italic">
        <ResearchIcon className="w-4 h-4" />
        <span>No active research</span>
      </div>
    );
  }

  const tech = ruleset.getTech(civ.currentResearch.techId);
  if (!tech) return null;

  const progress = civ.currentResearch.cost > 0
    ? (civ.currentResearch.progress / civ.currentResearch.cost) * 100
    : 0;
  const turnsRemaining = civ.sciencePerTurn > 0
    ? Math.ceil((civ.currentResearch.cost - civ.currentResearch.progress) / civ.sciencePerTurn)
    : Infinity;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ResearchIcon className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-medium text-gray-200">{tech.name}</span>
        </div>
        <span className="text-[10px] text-teal-400 font-mono">
          {turnsRemaining === Infinity ? '...' : `${turnsRemaining} turns`}
        </span>
      </div>
      <ProgressBar
        progress={progress}
        color="#14b8a6"
        bgColor="#1e293b"
        height="5px"
      />
      <div className="text-[9px] text-gray-500 text-right">
        {civ.currentResearch.progress}/{civ.currentResearch.cost} ({Math.floor(progress)}%)
      </div>
    </div>
  );
}

// ============================================================================
// Production Section (City Productions)
// ============================================================================

interface ProductionSectionProps {
  cities: City[];
}

function ProductionSection({ cities }: ProductionSectionProps) {
  const citiesWithProduction = cities.filter(c => c.currentProduction);

  if (citiesWithProduction.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-xs italic">
        <ProductionIcon className="w-4 h-4" />
        <span>No active production</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {citiesWithProduction.slice(0, 5).map((city) => {
        if (!city.currentProduction) return null;

        const { target, progress, cost, type } = city.currentProduction;
        const pct = cost > 0 ? (progress / cost) * 100 : 0;
        const turnsRemaining = city.productionPerTurn > 0
          ? Math.ceil((cost - progress) / city.productionPerTurn)
          : Infinity;

        // Get display name from ruleset
        let displayName = target;
        if (type === 'unit') {
          const unit = ruleset.getUnit(target);
          if (unit) displayName = unit.name;
        } else if (type === 'building') {
          const building = ruleset.getBuilding(target);
          if (building) displayName = building.name;
        }

        return (
          <div key={city.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: type === 'unit' ? '#ef4444' : '#f59e0b' }}
                />
                <span className="text-[10px] font-medium text-gray-300 truncate max-w-[100px]">
                  {city.name}
                </span>
              </div>
              <span className="text-[9px] text-amber-400 font-mono">
                {turnsRemaining === Infinity ? '...' : `${turnsRemaining}t`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ProgressBar
                  progress={pct}
                  color={type === 'unit' ? '#ef4444' : '#f59e0b'}
                  bgColor="#1e293b"
                  height="4px"
                />
              </div>
              <span className="text-[9px] text-gray-400 w-16 text-right truncate">
                {displayName}
              </span>
            </div>
          </div>
        );
      })}
      {citiesWithProduction.length > 5 && (
        <div className="text-[9px] text-gray-500 text-center">
          +{citiesWithProduction.length - 5} more cities
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main WorldTracker Component
// ============================================================================

export function WorldTracker() {
  const { state, perspective } = useCivGame();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCivId, setSelectedCivId] = useState<string | null>(null);

  // Determine which civ to show
  const civIds = Object.keys(state.civilizations);
  const displayCivId = useMemo(() => {
    if (selectedCivId && state.civilizations[selectedCivId]) {
      return selectedCivId;
    }
    if (perspective !== 'global' && state.civilizations[perspective]) {
      return perspective;
    }
    return civIds[0] ?? null;
  }, [selectedCivId, perspective, state.civilizations, civIds]);

  const civ = displayCivId ? state.civilizations[displayCivId] : null;
  const colors = displayCivId ? CIV_COLORS[displayCivId] : { primary: '#888', secondary: '#CCC', label: 'Unknown' };

  // Get cities for this civ
  const cities = useMemo(() => {
    if (!civ) return [];
    return civ.cities
      .map(id => state.cities[id])
      .filter(Boolean) as City[];
  }, [civ, state.cities]);

  if (!civ) return null;

  return (
    <div
      className="absolute left-3 top-3 z-30 select-none"
      style={{
        width: isCollapsed ? 'auto' : '220px',
      }}
    >
      {/* Panel container */}
      <div
        className="rounded-lg overflow-hidden shadow-xl"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.90) 100%)',
          border: '1px solid rgba(71, 85, 105, 0.5)',
        }}
      >
        {/* Header */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
          style={{
            borderBottom: isCollapsed ? 'none' : '1px solid rgba(71, 85, 105, 0.5)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-widest"
              style={{ color: '#d4a373' }}
            >
              WORLD TRACKER
            </span>
          </div>
          <ChevronIcon
            direction={isCollapsed ? 'down' : 'up'}
            className="w-4 h-4 text-gray-500"
          />
        </button>

        {/* Collapsible content */}
        {!isCollapsed && (
          <div className="p-3 space-y-4">
            {/* Civ selector (mini tabs) */}
            <div className="flex gap-1">
              {civIds.map(civId => {
                const c = CIV_COLORS[civId] ?? { primary: '#888', secondary: '#CCC', label: civId };
                const isActive = civId === displayCivId;
                return (
                  <button
                    key={civId}
                    onClick={() => setSelectedCivId(civId)}
                    className={`flex-1 px-1.5 py-1 rounded text-[9px] font-bold tracking-wider transition-all ${
                      isActive
                        ? 'ring-1'
                        : 'opacity-50 hover:opacity-75'
                    }`}
                    style={{
                      backgroundColor: isActive ? `${c.primary}20` : 'transparent',
                      color: c.primary,
                      boxShadow: isActive ? `0 0 0 1px ${c.primary}` : 'none',
                    }}
                    title={c.label}
                  >
                    {c.label.slice(0, 3).toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Current Civ indicator */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-700/50">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colors.primary }}
              />
              <span className="text-xs font-semibold text-gray-200">{civ.name}</span>
              {!civ.isAlive && (
                <span className="text-[8px] text-red-400 bg-red-900/30 px-1 py-0.5 rounded">
                  ELIMINATED
                </span>
              )}
            </div>

            {/* Research Section */}
            <div>
              <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-2">
                RESEARCH
              </div>
              <ResearchSection civ={civ} colors={colors} />
            </div>

            {/* Production Section */}
            <div>
              <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-2">
                PRODUCTION
              </div>
              <ProductionSection cities={cities} />
            </div>

            {/* Quick Stats */}
            <div className="pt-2 border-t border-gray-700/50">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[9px] text-gray-500">GOLD</div>
                  <div className="text-xs font-mono text-yellow-400">{civ.gold}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500">SCIENCE</div>
                  <div className="text-xs font-mono text-teal-400">+{civ.sciencePerTurn}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500">CITIES</div>
                  <div className="text-xs font-mono text-gray-200">{cities.length}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
