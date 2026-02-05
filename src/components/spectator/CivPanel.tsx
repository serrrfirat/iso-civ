'use client';

import React from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, GovernmentType } from '@/games/civ/types';
import { getGoldenAgeThreshold } from '@/lib/civ/civSimulation';
import { ruleset } from '@/lib/civ/ruleset';

interface CivPanelProps {
  civId: string;
}

export function CivPanel({ civId }: CivPanelProps) {
  const { state } = useCivGame();
  const civ = state.civilizations[civId];
  if (!civ) return null;

  const colors = CIV_COLORS[civId] ?? { primary: '#888', secondary: '#CCC', label: civId };
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

  // Golden age calculations
  const isInGoldenAge = civ.goldenAgeTurns > 0;
  const goldenAgeThreshold = getGoldenAgeThreshold(civ.goldenAgesCompleted);
  const goldenAgeProgress = isInGoldenAge ? 100 : (civ.goldenAgePoints / goldenAgeThreshold) * 100;

  // Government info
  const gov = ruleset.getGovernment(civ.government);
  const govName = gov?.name || civ.government;
  const isInAnarchy = civ.anarchyTurns > 0;

  return (
    <div
      className={`flex-1 px-4 py-3 border-l border-gray-700 first:border-l-0 ${isInGoldenAge ? 'ring-2 ring-yellow-400 ring-inset' : ''}`}
      style={{
        borderTopColor: colors.primary,
        borderTopWidth: '2px',
        background: isInGoldenAge ? 'linear-gradient(180deg, rgba(251, 191, 36, 0.15) 0%, transparent 100%)' : undefined
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.primary }} />
        <div className="text-sm font-bold" style={{ color: colors.primary }}>{civ.name}</div>
        {!civ.isAlive && <span className="text-[10px] text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">ELIMINATED</span>}
        {isInGoldenAge && (
          <span className="text-[10px] text-yellow-300 bg-yellow-900/50 px-1.5 py-0.5 rounded border border-yellow-500/50 animate-pulse">
            GOLDEN AGE ({civ.goldenAgeTurns})
          </span>
        )}
        {isInAnarchy && (
          <span className="text-[10px] text-red-300 bg-red-900/50 px-1.5 py-0.5 rounded border border-red-500/50 animate-pulse">
            ANARCHY ({civ.anarchyTurns})
          </span>
        )}
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

        <div className="text-gray-500">Happiness</div>
        <div className={`font-mono ${civ.happiness >= 0 ? 'text-green-400' : civ.happiness > -10 ? 'text-red-400' : 'text-red-600 font-bold'}`}>
          {civ.happiness >= 0 ? '+' : ''}{civ.happiness}
          {civ.happiness < 0 && civ.happiness >= -10 && <span className="text-[9px] ml-1 text-gray-400">(-25% prod)</span>}
          {civ.happiness < -10 && <span className="text-[9px] ml-1 text-red-400">(revolt!)</span>}
        </div>

        {/* Show war weariness only if at war */}
        {Object.values(civ.relationships).some(rel => rel === 'war') && (
          <>
            <div className="text-gray-500">War Weariness</div>
            <div className={`font-mono ${civ.warWeariness > 10 ? 'text-red-400' : civ.warWeariness > 5 ? 'text-orange-400' : 'text-yellow-400'}`}>
              {civ.warWeariness}
            </div>
          </>
        )}

        <div className="text-gray-500">Government</div>
        <div className={`font-mono text-[10px] ${isInAnarchy ? 'text-red-300' : 'text-blue-300'}`}>
          {isInAnarchy ? `Anarchy (${civ.anarchyTurns})` : govName}
        </div>

        {/* Golden Age Progress */}
        <div className="text-gray-500">Golden Age</div>
        <div className="col-span-1">
          {isInGoldenAge ? (
            <span className="text-yellow-300 font-mono text-[10px]">{civ.goldenAgeTurns} turns left</span>
          ) : (
            <div className="flex items-center gap-1">
              <div className="flex-1 h-1.5 bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full bg-yellow-500 transition-all duration-300"
                  style={{ width: `${Math.min(goldenAgeProgress, 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-gray-400 font-mono">{civ.goldenAgePoints}/{goldenAgeThreshold}</span>
            </div>
          )}
        </div>
      </div>

      {/* Spaceship Progress Indicator */}
      {(civ.spaceshipParts.booster || civ.spaceshipParts.cockpit || civ.spaceshipParts.engine) && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="text-[10px] text-purple-300 font-bold mb-1">SPACESHIP PROGRESS</div>
          <div className="flex gap-2">
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${civ.spaceshipParts.booster ? 'bg-green-900/50 text-green-300 border border-green-500/50' : 'bg-gray-800 text-gray-500'}`}>
              <span>{civ.spaceshipParts.booster ? '✓' : '○'}</span>
              <span>Booster</span>
            </div>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${civ.spaceshipParts.cockpit ? 'bg-green-900/50 text-green-300 border border-green-500/50' : 'bg-gray-800 text-gray-500'}`}>
              <span>{civ.spaceshipParts.cockpit ? '✓' : '○'}</span>
              <span>Cockpit</span>
            </div>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${civ.spaceshipParts.engine ? 'bg-green-900/50 text-green-300 border border-green-500/50' : 'bg-gray-800 text-gray-500'}`}>
              <span>{civ.spaceshipParts.engine ? '✓' : '○'}</span>
              <span>Engine</span>
            </div>
          </div>
        </div>
      )}

      {/* Relationship indicators */}
      <div className="mt-2 flex gap-1">
        {Object.keys(civ.relationships).filter(id => id !== civId).map(otherId => {
          const rel = civ.relationships[otherId];
          const relColor = rel === 'war' ? 'text-red-400' : rel === 'allied' ? 'text-green-400' : rel === 'hostile' ? 'text-orange-400' : rel === 'friendly' ? 'text-blue-400' : 'text-gray-500';
          return (
            <span key={otherId} className={`text-[10px] ${relColor}`}>
              {CIV_COLORS[otherId]?.label ?? otherId}: {rel}
            </span>
          );
        })}
      </div>
    </div>
  );
}
