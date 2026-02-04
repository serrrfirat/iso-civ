'use client';

import React from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CivId, CIV_COLORS } from '@/games/civ/types';

interface CivPanelProps {
  civId: CivId;
}

export function CivPanel({ civId }: CivPanelProps) {
  const { state } = useCivGame();
  const civ = state.civilizations[civId];
  if (!civ) return null;

  const colors = CIV_COLORS[civId];
  const unitCount = civ.units.filter(id => state.units[id]).length;
  const cityCount = civ.cities.filter(id => state.cities[id]).length;

  // Military strength = sum of (attack + defense) for all units
  const militaryStrength = civ.units
    .map(id => state.units[id])
    .filter(Boolean)
    .reduce((sum, u) => sum + u.attack + u.defense, 0);

  // Total gold income
  const goldIncome = civ.cities
    .map(id => state.cities[id])
    .filter(Boolean)
    .reduce((sum, c) => sum + c.goldPerTurn, 0);

  return (
    <div
      className="flex-1 px-4 py-3 border-l border-gray-700 first:border-l-0"
      style={{ borderTopColor: colors.primary, borderTopWidth: '2px' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.primary }} />
        <div className="text-sm font-bold" style={{ color: colors.primary }}>{civ.name}</div>
        {!civ.isAlive && <span className="text-[10px] text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">ELIMINATED</span>}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-gray-500">Gold</div>
        <div className="text-yellow-300 font-mono">{civ.gold} (+{goldIncome})</div>

        <div className="text-gray-500">Cities</div>
        <div className="text-gray-200 font-mono">{cityCount}</div>

        <div className="text-gray-500">Units</div>
        <div className="text-gray-200 font-mono">{unitCount}</div>

        <div className="text-gray-500">Military</div>
        <div className="text-gray-200 font-mono">{militaryStrength}</div>

        <div className="text-gray-500">Score</div>
        <div className="text-gray-200 font-mono">{civ.score}</div>
      </div>

      {/* Relationship indicators */}
      <div className="mt-2 flex gap-1">
        {(['rome', 'egypt', 'mongolia'] as CivId[]).filter(id => id !== civId).map(otherId => {
          const rel = civ.relationships[otherId];
          const relColor = rel === 'war' ? 'text-red-400' : rel === 'allied' ? 'text-green-400' : rel === 'hostile' ? 'text-orange-400' : rel === 'friendly' ? 'text-blue-400' : 'text-gray-500';
          return (
            <span key={otherId} className={`text-[10px] ${relColor}`}>
              {CIV_COLORS[otherId].label}: {rel}
            </span>
          );
        })}
      </div>
    </div>
  );
}
