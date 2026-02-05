'use client';

import React from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS } from '@/games/civ/types';
import { ruleset, RulesetBuilding } from '@/lib/civ/ruleset';

// ── Yield icons as small colored labels ──

function YieldBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`text-xs font-bold ${color}`}>{label}</span>
      <span className="text-sm text-white font-semibold">{value >= 0 ? `+${value}` : value}</span>
    </div>
  );
}

// ── Production progress bar ──

function ProductionProgress({
  targetName,
  targetType,
  progress,
  cost,
  productionPerTurn,
}: {
  targetName: string;
  targetType: 'unit' | 'building';
  progress: number;
  cost: number;
  productionPerTurn: number;
}) {
  const pct = Math.min((progress / cost) * 100, 100);
  const remaining = cost - progress;
  const turnsLeft = productionPerTurn > 0 ? Math.ceil(remaining / productionPerTurn) : Infinity;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-orange-300 font-semibold capitalize">
          {targetType === 'unit' ? 'Training' : 'Building'}: {targetName}
        </span>
        <span className="text-gray-400">
          {turnsLeft === Infinity ? '---' : `${turnsLeft} turn${turnsLeft !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 text-right">
        {progress}/{cost}
      </div>
    </div>
  );
}

// ── Single building card ──

function BuildingCard({ buildingId }: { buildingId: string }) {
  const bldg: RulesetBuilding | undefined = ruleset.getBuilding(buildingId);
  if (!bldg) {
    return (
      <div className="px-2 py-1.5 rounded bg-gray-800 border border-gray-700">
        <span className="text-xs text-gray-400">{buildingId}</span>
      </div>
    );
  }

  const isWonder = bldg.isWonder === true;
  const effectEntries = Object.entries(bldg.effects);

  return (
    <div
      className={`px-2 py-1.5 rounded border ${
        isWonder
          ? 'bg-yellow-900/30 border-yellow-600/50'
          : 'bg-gray-800 border-gray-700'
      }`}
    >
      <div className={`text-xs font-semibold truncate ${isWonder ? 'text-yellow-300' : 'text-gray-200'}`}>
        {bldg.name}
      </div>
      {effectEntries.length > 0 && (
        <div className="flex flex-wrap gap-x-2 mt-0.5">
          {effectEntries.map(([key, val]) => (
            <span key={key} className={`text-[10px] ${getEffectColor(key)}`}>
              +{val} {key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function getEffectColor(effectName: string): string {
  switch (effectName) {
    case 'gold':       return 'text-yellow-400';
    case 'food':       return 'text-green-400';
    case 'production': return 'text-orange-400';
    case 'science':    return 'text-blue-400';
    case 'culture':    return 'text-purple-400';
    case 'defense':    return 'text-gray-300';
    default:           return 'text-gray-400';
  }
}

function getProductionTargetName(type: 'unit' | 'building', target: string): string {
  if (type === 'unit') {
    const u = ruleset.getUnit(target);
    return u?.name ?? target;
  }
  const b = ruleset.getBuilding(target);
  return b?.name ?? target;
}

// ── Main component ──

export function CityDetailPanel() {
  const { state, selectedCityId, setSelectedCityId } = useCivGame();

  if (!selectedCityId) return null;

  const city = state.cities[selectedCityId];
  if (!city) return null;

  const civColors = CIV_COLORS[city.ownerId];
  const civName = civColors?.label ?? city.ownerId;
  const primaryColor = civColors?.primary ?? '#888888';

  // Sort buildings: wonders first, then alphabetical
  const sortedBuildings = [...city.buildings].sort((a, b) => {
    const aWonder = ruleset.getBuilding(a)?.isWonder === true;
    const bWonder = ruleset.getBuilding(b)?.isWonder === true;
    if (aWonder && !bWonder) return -1;
    if (!aWonder && bWonder) return 1;
    const aName = ruleset.getBuilding(a)?.name ?? a;
    const bName = ruleset.getBuilding(b)?.name ?? b;
    return aName.localeCompare(bName);
  });

  return (
    <div
      className="absolute left-2 top-2 w-[300px] max-h-[calc(100%-16px)] bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col z-20 animate-in slide-in-from-left-2 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-gray-700" style={{ borderTopColor: primaryColor, borderTopWidth: '3px' }}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white truncate">{city.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: primaryColor + '33', color: primaryColor }}
              >
                {civName}
              </span>
              <span className="text-xs text-gray-400">Pop: {city.population}</span>
              <span className="text-xs text-gray-400">Def: {city.defense}</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedCityId(null)}
            className="text-gray-500 hover:text-white transition-colors p-0.5 -mt-1 -mr-1 rounded hover:bg-gray-700"
            aria-label="Close city panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {/* ── Yields row ── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">Yields per turn</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <YieldBadge label="Gold" value={city.goldPerTurn} color="text-yellow-400" />
            <YieldBadge label="Food" value={city.foodPerTurn} color="text-green-400" />
            <YieldBadge label="Prod" value={city.productionPerTurn} color="text-orange-400" />
            <YieldBadge label="Sci" value={city.sciencePerTurn} color="text-blue-400" />
          </div>
        </div>

        {/* ── Current production ── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">Production</div>
          {city.currentProduction ? (
            <ProductionProgress
              targetName={getProductionTargetName(city.currentProduction.type, city.currentProduction.target)}
              targetType={city.currentProduction.type}
              progress={city.currentProduction.progress}
              cost={city.currentProduction.cost}
              productionPerTurn={city.productionPerTurn}
            />
          ) : (
            <div className="text-xs text-gray-500 italic">Nothing in production</div>
          )}
        </div>

        {/* ── Buildings list ── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">
            Buildings ({city.buildings.length})
          </div>
          {sortedBuildings.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {sortedBuildings.map((bId) => (
                <BuildingCard key={bId} buildingId={bId} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">No buildings</div>
          )}
        </div>

        {/* ── Location ── */}
        <div className="text-xs text-gray-600 text-right pt-1 border-t border-gray-800">
          Tile ({city.x}, {city.y})
        </div>
      </div>
    </div>
  );
}
