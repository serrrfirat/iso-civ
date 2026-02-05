'use client';

import React from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, RelationshipStatus } from '@/games/civ/types';

// Icons for stats
function GoldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function ScienceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
      <path d="M9 3v6l-2 4v5a2 2 0 002 2h6a2 2 0 002-2v-5l-2-4V3" />
      <path d="M9 3h6" />
    </svg>
  );
}

function MilitaryIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
      <path d="M12 2L4 7v6c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V7l-8-5z" />
    </svg>
  );
}

// Relationship status badge
function RelationshipBadge({ status }: { status: RelationshipStatus }) {
  const statusStyles: Record<RelationshipStatus, { bg: string; text: string; border: string; label: string }> = {
    war: { bg: 'bg-red-900/60', text: 'text-red-300', border: 'border-red-500', label: 'WAR' },
    hostile: { bg: 'bg-orange-900/50', text: 'text-orange-300', border: 'border-orange-500', label: 'HOSTILE' },
    neutral: { bg: 'bg-gray-700/50', text: 'text-gray-400', border: 'border-gray-500', label: 'NEUTRAL' },
    friendly: { bg: 'bg-blue-900/50', text: 'text-blue-300', border: 'border-blue-500', label: 'FRIENDLY' },
    allied: { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-500', label: 'ALLIED' },
  };

  const style = statusStyles[status];

  return (
    <span className={`text-[8px] px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border} font-bold tracking-wider`}>
      {style.label}
    </span>
  );
}

interface CivRowProps {
  civId: string;
  isCurrentPerspective: boolean;
  relationshipWithViewed: RelationshipStatus | null;
  onClick: () => void;
}

function CivRow({ civId, isCurrentPerspective, relationshipWithViewed, onClick }: CivRowProps) {
  const { state } = useCivGame();
  const civ = state.civilizations[civId];

  if (!civ) return null;

  const colors = CIV_COLORS[civId] ?? { primary: '#888', secondary: '#CCC', label: civId };

  // Calculate stats
  const goldIncome = civ.cities
    .map(id => state.cities[id])
    .filter(Boolean)
    .reduce((sum, c) => sum + c.goldPerTurn, 0);

  const sciencePerTurn = civ.cities
    .map(id => state.cities[id])
    .filter(Boolean)
    .reduce((sum, c) => sum + c.sciencePerTurn, 0);

  const militaryStrength = civ.units
    .map(id => state.units[id])
    .filter(Boolean)
    .reduce((sum, u) => sum + u.attack + u.defense, 0);

  const isEliminated = !civ.isAlive;

  return (
    <button
      onClick={onClick}
      className={`
        w-full px-3 py-2 flex items-center gap-2 transition-all duration-150
        border-l-2 hover:bg-[#1a2744]
        ${isCurrentPerspective
          ? 'bg-[#1a2744] border-l-amber-400'
          : 'bg-transparent border-l-transparent hover:border-l-gray-500'
        }
        ${isEliminated ? 'opacity-50' : ''}
      `}
      style={{
        borderLeftColor: isCurrentPerspective ? colors.primary : undefined,
      }}
    >
      {/* Civ color indicator */}
      <div
        className="w-5 h-5 rounded-sm flex-shrink-0 flex items-center justify-center"
        style={{
          backgroundColor: colors.primary,
          border: `2px solid ${colors.secondary}`,
        }}
      >
        {isEliminated && (
          <span className="text-[8px] text-white font-bold">X</span>
        )}
      </div>

      {/* Civ name and relationship */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: isCurrentPerspective ? colors.primary : '#e5e7eb' }}
          >
            {civ.name}
          </span>
          {isCurrentPerspective && (
            <span className="text-[8px] px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/50">
              VIEWING
            </span>
          )}
        </div>
        {/* Show relationship only if not viewing global and not the viewed civ */}
        {relationshipWithViewed && !isCurrentPerspective && (
          <div className="mt-0.5">
            <RelationshipBadge status={relationshipWithViewed} />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Gold */}
        <div className="flex items-center gap-1" title="Gold per turn">
          <GoldIcon />
          <span className="text-[10px] font-mono text-yellow-300 w-5 text-right">
            {goldIncome}
          </span>
        </div>

        {/* Science */}
        <div className="flex items-center gap-1" title="Science per turn">
          <ScienceIcon />
          <span className="text-[10px] font-mono text-blue-300 w-5 text-right">
            {sciencePerTurn}
          </span>
        </div>

        {/* Military */}
        <div className="flex items-center gap-1" title="Military strength">
          <MilitaryIcon />
          <span className="text-[10px] font-mono text-red-300 w-5 text-right">
            {militaryStrength}
          </span>
        </div>
      </div>
    </button>
  );
}

export function CivTracker() {
  const { state, perspective, setPerspective } = useCivGame();

  const civIds = Object.keys(state.civilizations);
  const viewedCiv = perspective !== 'global' ? state.civilizations[perspective] : null;

  // Get relationship between viewed civ and each other civ
  const getRelationshipWithViewed = (civId: string): RelationshipStatus | null => {
    if (perspective === 'global') return null;
    if (civId === perspective) return null;
    return viewedCiv?.relationships[civId] ?? 'neutral';
  };

  return (
    <div
      className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col"
      style={{
        width: '220px',
        maxHeight: 'calc(100vh - 200px)',
      }}
    >
      {/* Panel header */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{
          background: 'linear-gradient(180deg, #1a2744 0%, #0f172a 100%)',
          borderTop: '2px solid #d4af37',
          borderLeft: '2px solid #d4af37',
          borderBottom: '1px solid #d4af37',
          borderTopLeftRadius: '4px',
        }}
      >
        <span className="text-[10px] font-bold tracking-widest text-amber-200">
          CIVILIZATIONS
        </span>
        <span className="text-[10px] font-mono text-gray-400">
          {civIds.filter(id => state.civilizations[id]?.isAlive).length}/{civIds.length}
        </span>
      </div>

      {/* Civ list */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1a2744 100%)',
          borderLeft: '2px solid #b8860b',
          borderBottom: '2px solid #b8860b',
          borderBottomLeftRadius: '4px',
        }}
      >
        {/* Global view option */}
        <button
          onClick={() => setPerspective('global')}
          className={`
            w-full px-3 py-2 flex items-center gap-2 transition-all duration-150
            border-l-2 hover:bg-[#1a2744] border-b border-gray-700/50
            ${perspective === 'global'
              ? 'bg-[#1a2744] border-l-amber-400'
              : 'bg-transparent border-l-transparent hover:border-l-gray-500'
            }
          `}
        >
          <div
            className="w-5 h-5 rounded-sm flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500"
            style={{ border: '2px solid #fff' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <span className={`text-xs font-semibold ${perspective === 'global' ? 'text-amber-300' : 'text-gray-300'}`}>
            Global View
          </span>
          {perspective === 'global' && (
            <span className="ml-auto text-[8px] px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/50">
              VIEWING
            </span>
          )}
        </button>

        {/* Separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent mx-2" />

        {/* Civ rows */}
        {civIds.map(civId => (
          <CivRow
            key={civId}
            civId={civId}
            isCurrentPerspective={perspective === civId}
            relationshipWithViewed={getRelationshipWithViewed(civId)}
            onClick={() => setPerspective(civId)}
          />
        ))}
      </div>

      {/* Panel footer with legend */}
      <div
        className="px-2 py-1.5"
        style={{
          background: '#0f172a',
          borderLeft: '2px solid #8b7500',
          borderBottom: '2px solid #8b7500',
          borderBottomLeftRadius: '4px',
        }}
      >
        <div className="flex items-center justify-center gap-2 text-[8px] text-gray-500">
          <span className="flex items-center gap-0.5">
            <GoldIcon /> GPT
          </span>
          <span className="flex items-center gap-0.5">
            <ScienceIcon /> SPT
          </span>
          <span className="flex items-center gap-0.5">
            <MilitaryIcon /> MIL
          </span>
        </div>
      </div>
    </div>
  );
}
