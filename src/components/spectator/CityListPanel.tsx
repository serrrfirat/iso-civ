'use client';

import React, { useState, useMemo } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, City, CivId } from '@/games/civ/types';
import { ruleset } from '@/lib/civ/ruleset';

// ── Types ──

type SortMode = 'population' | 'production';

interface CityRowProps {
  city: City;
  isSelected: boolean;
  onSelect: () => void;
}

// ── Helpers ──

function getProductionTargetName(type: 'unit' | 'building', target: string): string {
  if (type === 'unit') {
    const u = ruleset.getUnit(target);
    return u?.name ?? target;
  }
  const b = ruleset.getBuilding(target);
  return b?.name ?? target;
}

function getProductionProgressPct(city: City): number {
  if (!city.currentProduction) return 0;
  return Math.min((city.currentProduction.progress / city.currentProduction.cost) * 100, 100);
}

function getTurnsLeft(city: City): number | null {
  if (!city.currentProduction) return null;
  const remaining = city.currentProduction.cost - city.currentProduction.progress;
  if (city.productionPerTurn <= 0) return null;
  return Math.ceil(remaining / city.productionPerTurn);
}

// ── City Row Component ──

function CityRow({ city, isSelected, onSelect }: CityRowProps) {
  const civColors = CIV_COLORS[city.ownerId];
  const primaryColor = civColors?.primary ?? '#888888';
  const turnsLeft = getTurnsLeft(city);
  const progressPct = getProductionProgressPct(city);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-2 rounded-lg border transition-all ${
        isSelected
          ? 'bg-gray-700/80 border-blue-500'
          : 'bg-gray-800/60 border-gray-700 hover:bg-gray-700/60 hover:border-gray-600'
      }`}
    >
      {/* City name + population */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: primaryColor }}
          />
          <span className="text-sm font-semibold text-white truncate">{city.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          <span className="text-gray-400">Pop: <span className="text-white font-medium">{city.population}</span></span>
          <span className="text-gray-400">Def: <span className="text-gray-300">{city.defense}</span></span>
        </div>
      </div>

      {/* Yields row */}
      <div className="flex items-center gap-3 text-[10px] mb-1.5">
        <span className="text-green-400">F:{city.foodPerTurn}</span>
        <span className="text-orange-400">P:{city.productionPerTurn}</span>
        <span className="text-yellow-400">G:{city.goldPerTurn}</span>
        <span className="text-blue-400">S:{city.sciencePerTurn}</span>
      </div>

      {/* Production progress */}
      {city.currentProduction ? (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-orange-300 truncate">
              {getProductionTargetName(city.currentProduction.type, city.currentProduction.target)}
            </span>
            <span className="text-gray-500 shrink-0 ml-2">
              {turnsLeft !== null ? `${turnsLeft}t` : '---'}
            </span>
          </div>
          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-gray-500 italic">No production</div>
      )}
    </button>
  );
}

// ── Civ Group Component ──

interface CivGroupProps {
  civId: CivId;
  civName: string;
  cities: City[];
  selectedCityId: string | null;
  onSelectCity: (cityId: string) => void;
  primaryColor: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function CivGroup({
  civId,
  civName,
  cities,
  selectedCityId,
  onSelectCity,
  primaryColor,
  isExpanded,
  onToggle,
}: CivGroupProps) {
  const totalPop = cities.reduce((sum, c) => sum + c.population, 0);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Civ header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/80 hover:bg-gray-700/80 transition-colors"
        style={{ borderLeftWidth: '3px', borderLeftColor: primaryColor }}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-bold" style={{ color: primaryColor }}>
            {civName}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {cities.length} {cities.length === 1 ? 'city' : 'cities'} / Pop: {totalPop}
        </div>
      </button>

      {/* Cities list */}
      {isExpanded && (
        <div className="p-2 space-y-1.5 bg-gray-900/50">
          {cities.map((city) => (
            <CityRow
              key={city.id}
              city={city}
              isSelected={selectedCityId === city.id}
              onSelect={() => onSelectCity(city.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export function CityListPanel() {
  const { state, selectedCityId, setSelectedCityId, panToGrid } = useCivGame();
  const [sortMode, setSortMode] = useState<SortMode>('population');
  const [expandedCivs, setExpandedCivs] = useState<Set<string>>(() => {
    // Start with all civs expanded
    return new Set(Object.keys(state.civilizations));
  });

  // Group cities by civ and sort
  const citiesByCiv = useMemo(() => {
    const grouped: Record<CivId, City[]> = {};

    // Initialize groups for all civs
    for (const civId of Object.keys(state.civilizations)) {
      grouped[civId] = [];
    }

    // Group cities
    for (const city of Object.values(state.cities)) {
      if (grouped[city.ownerId]) {
        grouped[city.ownerId].push(city);
      }
    }

    // Sort cities within each group
    for (const civId of Object.keys(grouped)) {
      grouped[civId].sort((a, b) => {
        if (sortMode === 'population') {
          return b.population - a.population;
        } else {
          return b.productionPerTurn - a.productionPerTurn;
        }
      });
    }

    return grouped;
  }, [state.cities, state.civilizations, sortMode]);

  // Sort civs by total population
  const sortedCivIds = useMemo(() => {
    return Object.keys(citiesByCiv).sort((a, b) => {
      const popA = citiesByCiv[a].reduce((sum, c) => sum + c.population, 0);
      const popB = citiesByCiv[b].reduce((sum, c) => sum + c.population, 0);
      return popB - popA;
    });
  }, [citiesByCiv]);

  const handleSelectCity = (cityId: string) => {
    setSelectedCityId(cityId);
    const city = state.cities[cityId];
    if (city) {
      panToGrid(city.x, city.y);
    }
  };

  const toggleCiv = (civId: string) => {
    setExpandedCivs((prev) => {
      const next = new Set(prev);
      if (next.has(civId)) {
        next.delete(civId);
      } else {
        next.add(civId);
      }
      return next;
    });
  };

  const totalCities = Object.values(state.cities).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header with sort controls */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
            Cities ({totalCities})
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500 mr-1">Sort:</span>
          <button
            onClick={() => setSortMode('population')}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              sortMode === 'population'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Population
          </button>
          <button
            onClick={() => setSortMode('production')}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              sortMode === 'production'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Production
          </button>
        </div>
      </div>

      {/* Scrollable city list grouped by civ */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sortedCivIds.map((civId) => {
          const civ = state.civilizations[civId];
          const civColors = CIV_COLORS[civId];
          const cities = citiesByCiv[civId];

          if (!civ || cities.length === 0) return null;

          return (
            <CivGroup
              key={civId}
              civId={civId}
              civName={civColors?.label ?? civ.name}
              cities={cities}
              selectedCityId={selectedCityId}
              onSelectCity={handleSelectCity}
              primaryColor={civColors?.primary ?? '#888888'}
              isExpanded={expandedCivs.has(civId)}
              onToggle={() => toggleCiv(civId)}
            />
          );
        })}

        {totalCities === 0 && (
          <div className="text-center text-gray-500 text-sm py-8 italic">
            No cities founded yet
          </div>
        )}
      </div>
    </div>
  );
}
