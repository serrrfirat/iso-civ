'use client';

import React from 'react';
import { useCivGame } from '@/context/CivGameContext';

// SVG Icons for resources
const ScienceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M7 2v2h1v6.17a5 5 0 1 0 8 0V4h1V2H7zm5 18a3 3 0 0 1-2.83-4h5.66A3 3 0 0 1 12 20zm2-6H10V4h4v10z" />
  </svg>
);

const GoldIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" fill="none" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">$</text>
  </svg>
);

const CultureIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);

const ProductionIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12.5 2L2 7v10l10.5 5 10.5-5V7l-10.5-5zm-1 15.75L4 14.31V9.44l7.5 3.75v5.56zm1-7.5L5.23 6.5 12.5 3l7.27 3.5L12.5 10.25zm8 4.56l-7.5 3.75v-5.56l7.5-3.75v5.56z" />
  </svg>
);

const FaithIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
  </svg>
);

// Phase labels and colors matching TurnIndicator
const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: 'IDLE', color: 'text-gray-400' },
  diplomacy: { label: 'DIPLOMACY', color: 'text-purple-400' },
  planning: { label: 'PLANNING', color: 'text-blue-400' },
  resolution: { label: 'RESOLUTION', color: 'text-orange-400' },
  narration: { label: 'NARRATION', color: 'text-green-400' },
};

// Convert turn number to approximate year/era
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

// Format number with appropriate precision
function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return value.toFixed(1);
}

interface ResourceDisplayProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  iconColor: string;
}

function ResourceDisplay({ icon, value, label, iconColor }: ResourceDisplayProps) {
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1" title={label}>
      <span style={{ color: iconColor }}>{icon}</span>
      <span className={`font-bold text-sm tracking-tight ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{formatValue(value)}
      </span>
    </div>
  );
}

export function TopBar() {
  const { state } = useCivGame();
  const phaseInfo = PHASE_LABELS[state.phase] || PHASE_LABELS.idle;
  const { year, era } = getTurnEra(state.turn, state.maxTurns);

  // Calculate total empire yields from all civilizations
  const totalYields = Object.values(state.civilizations).reduce(
    (acc, civ) => {
      if (!civ.isAlive) return acc;

      // Sum city yields
      const civCities = civ.cities.map(id => state.cities[id]).filter(Boolean);
      const cityYields = civCities.reduce(
        (cityAcc, city) => ({
          science: cityAcc.science + (city?.sciencePerTurn || 0),
          gold: cityAcc.gold + (city?.goldPerTurn || 0),
          culture: cityAcc.culture + (city?.culturePerTurn || 0),
          production: cityAcc.production + (city?.productionPerTurn || 0),
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

  // Calculate total treasury from all civs
  const totalTreasury = Object.values(state.civilizations).reduce(
    (sum, civ) => sum + (civ.isAlive ? civ.gold : 0),
    0
  );

  return (
    <div className="relative shrink-0">
      {/* Main bar with gradient background */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: 'linear-gradient(180deg, #1a3a4a 0%, #0d2533 50%, #0a1c28 100%)',
          borderBottom: '2px solid',
          borderImage: 'linear-gradient(90deg, #8B6914 0%, #D4AF37 25%, #F5D442 50%, #D4AF37 75%, #8B6914 100%) 1',
        }}
      >
        {/* Left section: Resource yields */}
        <div className="flex items-center gap-1">
          <ResourceDisplay
            icon={<ScienceIcon />}
            value={totalYields.science}
            label="Science per turn"
            iconColor="#5BC0EB"
          />
          <div className="w-px h-4 bg-gray-600/50" />
          <ResourceDisplay
            icon={<GoldIcon />}
            value={totalYields.gold}
            label="Gold per turn"
            iconColor="#FFD700"
          />
          <div className="w-px h-4 bg-gray-600/50" />
          <ResourceDisplay
            icon={<CultureIcon />}
            value={totalYields.culture}
            label="Culture per turn"
            iconColor="#9B59B6"
          />
          <div className="w-px h-4 bg-gray-600/50" />
          <ResourceDisplay
            icon={<ProductionIcon />}
            value={totalYields.production}
            label="Production per turn"
            iconColor="#E67E22"
          />
          <div className="w-px h-4 bg-gray-600/50" />
          {/* Treasury display */}
          <div className="flex items-center gap-1.5 px-2 py-1" title="Total Treasury">
            <span style={{ color: '#FFD700' }}>
              <FaithIcon />
            </span>
            <span className="font-bold text-sm tracking-tight text-amber-300">
              {totalTreasury.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Center section: Game title with phase indicator */}
        <div className="flex items-center gap-4">
          <div className="text-gray-300 text-sm font-bold tracking-[0.15em] uppercase" style={{ fontFamily: 'system-ui, sans-serif' }}>
            AGENT CIVILIZATION
          </div>
          <div className={`text-xs font-bold tracking-wider ${phaseInfo.color}`}>
            {state.phase !== 'idle' && (
              <span className="inline-block w-2 h-2 rounded-full bg-current mr-1.5 animate-pulse" />
            )}
            {phaseInfo.label}
          </div>
          {state.winner && (
            <div className="text-yellow-400 font-bold text-sm animate-pulse">
              VICTORY: {state.civilizations[state.winner]?.name}
            </div>
          )}
        </div>

        {/* Right section: Turn counter and era */}
        <div className="flex items-center gap-4">
          {/* Era display */}
          <div className="text-right">
            <div className="text-xs text-gray-400 font-medium tracking-wide uppercase">
              {era}
            </div>
            <div className="text-sm text-amber-200 font-bold tracking-wide">
              {year}
            </div>
          </div>

          <div className="w-px h-8 bg-gradient-to-b from-transparent via-amber-600/50 to-transparent" />

          {/* Turn counter - Civ 6 style */}
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-gray-400 font-bold tracking-wider">TURN</span>
            <span className="text-xl text-white font-bold" style={{ fontFamily: 'system-ui, sans-serif' }}>
              {state.turn}
            </span>
            <span className="text-sm text-gray-500 font-bold">
              /{state.maxTurns}
            </span>
          </div>
        </div>
      </div>

      {/* Decorative gold corner accents */}
      <div
        className="absolute top-0 left-0 w-8 h-8 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute top-0 right-0 w-8 h-8 pointer-events-none"
        style={{
          background: 'linear-gradient(-135deg, rgba(212, 175, 55, 0.2) 0%, transparent 50%)',
        }}
      />
    </div>
  );
}
