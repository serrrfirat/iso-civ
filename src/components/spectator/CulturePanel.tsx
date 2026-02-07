'use client';

import React, { useState } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, CulturalArtifact, CulturalArtifactType } from '@/games/civ/types';

const ARTIFACT_COLORS: Record<CulturalArtifactType, { bg: string; text: string; border: string }> = {
  law: { bg: 'bg-amber-900/30', text: 'text-amber-300', border: 'border-amber-700/50' },
  decree: { bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-700/50' },
  religious_text: { bg: 'bg-purple-900/30', text: 'text-purple-300', border: 'border-purple-700/50' },
  propaganda: { bg: 'bg-orange-900/30', text: 'text-orange-300', border: 'border-orange-700/50' },
  tradition: { bg: 'bg-green-900/30', text: 'text-green-300', border: 'border-green-700/50' },
  constitutional: { bg: 'bg-blue-900/30', text: 'text-blue-300', border: 'border-blue-700/50' },
};

const ARTIFACT_LABELS: Record<CulturalArtifactType, string> = {
  law: 'LAW',
  decree: 'DECREE',
  religious_text: 'RELIGIOUS',
  propaganda: 'PROPAGANDA',
  tradition: 'TRADITION',
  constitutional: 'CONST.',
};

export function CulturePanel() {
  const { state } = useCivGame();
  const civIds = Object.keys(state.civilizations).filter(id => state.civilizations[id].isAlive);
  const [selectedCiv, setSelectedCiv] = useState(civIds[0] || '');
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());

  const civ = state.civilizations[selectedCiv];
  const culture = civ?.culture;

  const toggleTurn = (turn: number) => {
    setExpandedTurns(prev => {
      const next = new Set(prev);
      if (next.has(turn)) next.delete(turn);
      else next.add(turn);
      return next;
    });
  };

  if (!civ || !culture) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
        No cultural data available yet. Advance a turn to see cultural artifacts.
      </div>
    );
  }

  // Group artifacts by turn
  const artifactsByTurn = new Map<number, CulturalArtifact[]>();
  for (const artifact of culture.artifacts) {
    const list = artifactsByTurn.get(artifact.turn) || [];
    list.push(artifact);
    artifactsByTurn.set(artifact.turn, list);
  }
  const sortedTurns = [...artifactsByTurn.keys()].sort((a, b) => b - a);

  // Active laws/constitutional articles
  const activeLaws = culture.artifacts.filter(
    a => a.isActive && (a.type === 'law' || a.type === 'constitutional')
  );

  return (
    <div className="flex flex-col h-full">
      {/* Civ tabs */}
      <div className="flex border-b border-gray-700 shrink-0">
        {civIds.map(id => {
          const colors = CIV_COLORS[id];
          const isActive = id === selectedCiv;
          return (
            <button
              key={id}
              onClick={() => setSelectedCiv(id)}
              className={`flex-1 px-3 py-2 text-xs font-bold tracking-wider transition-colors ${
                isActive
                  ? 'text-white bg-gray-800'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
              style={isActive ? { borderBottom: `2px solid ${colors?.primary || '#888'}` } : undefined}
            >
              {colors?.label || id}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Section 1: Cultural Identity */}
        <div className="px-3 py-3 border-b border-gray-700/50">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Cultural Identity</h3>

          {culture.constitutionName && (
            <div className="mb-1">
              <span className="text-[10px] text-gray-500">Constitution: </span>
              <span className="text-xs text-blue-300 font-medium">&quot;{culture.constitutionName}&quot;</span>
            </div>
          )}
          {culture.religionName && (
            <div className="mb-1">
              <span className="text-[10px] text-gray-500">Religion: </span>
              <span className="text-xs text-purple-300 font-medium">&quot;{culture.religionName}&quot;</span>
            </div>
          )}

          {culture.summary && (
            <div className="mt-2 space-y-1.5">
              {culture.summary.governingPrinciples && (
                <div>
                  <span className="text-[10px] text-gray-500 block">Governing Principles</span>
                  <span className="text-xs text-gray-300">{culture.summary.governingPrinciples}</span>
                </div>
              )}
              {culture.summary.religiousIdentity && (
                <div>
                  <span className="text-[10px] text-gray-500 block">Religious Identity</span>
                  <span className="text-xs text-gray-300">{culture.summary.religiousIdentity}</span>
                </div>
              )}
              {culture.summary.culturalValues && (
                <div>
                  <span className="text-[10px] text-gray-500 block">Cultural Values</span>
                  <span className="text-xs text-gray-300">{culture.summary.culturalValues}</span>
                </div>
              )}
              {culture.summary.propagandaThemes && (
                <div>
                  <span className="text-[10px] text-gray-500 block">Propaganda Themes</span>
                  <span className="text-xs text-gray-300">{culture.summary.propagandaThemes}</span>
                </div>
              )}
            </div>
          )}

          {!culture.constitutionName && !culture.religionName && !culture.summary && (
            <div className="text-xs text-gray-600 italic">No cultural identity established yet.</div>
          )}
        </div>

        {/* Section 2: Active Laws & Principles */}
        <div className="px-3 py-3 border-b border-gray-700/50">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Active Laws & Principles ({activeLaws.length})
          </h3>
          {activeLaws.length === 0 ? (
            <div className="text-xs text-gray-600 italic">No active laws.</div>
          ) : (
            <div className="space-y-1.5">
              {activeLaws.map(artifact => {
                const colors = ARTIFACT_COLORS[artifact.type];
                return (
                  <div key={artifact.id} className={`p-2 rounded border ${colors.bg} ${colors.border}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${colors.text}`}>
                        {ARTIFACT_LABELS[artifact.type]}
                      </span>
                      <span className="text-xs text-gray-300 font-medium">&quot;{artifact.title}&quot;</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-relaxed">{artifact.content}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Cultural Timeline */}
        <div className="px-3 py-3">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Cultural Timeline ({culture.artifacts.length} artifacts)
          </h3>
          {sortedTurns.length === 0 ? (
            <div className="text-xs text-gray-600 italic">No cultural artifacts yet.</div>
          ) : (
            <div className="space-y-1">
              {sortedTurns.map(turn => {
                const artifacts = artifactsByTurn.get(turn) || [];
                const isExpanded = expandedTurns.has(turn);
                return (
                  <div key={turn}>
                    <button
                      onClick={() => toggleTurn(turn)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800/40 text-left"
                    >
                      <span className="text-[10px] text-gray-500">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                      <span className="text-xs text-gray-400 font-medium">Turn {turn}</span>
                      <span className="text-[10px] text-gray-600">({artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''})</span>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 space-y-1 mb-2">
                        {artifacts.map(artifact => {
                          const colors = ARTIFACT_COLORS[artifact.type];
                          const isSuperseded = !artifact.isActive;
                          return (
                            <div
                              key={artifact.id}
                              className={`p-2 rounded border ${colors.bg} ${colors.border} ${isSuperseded ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${colors.text}`}>
                                  {ARTIFACT_LABELS[artifact.type]}
                                </span>
                                <span className={`text-xs text-gray-300 font-medium ${isSuperseded ? 'line-through' : ''}`}>
                                  &quot;{artifact.title}&quot;
                                </span>
                              </div>
                              <div className={`text-[11px] text-gray-400 leading-relaxed ${isSuperseded ? 'line-through' : ''}`}>
                                {artifact.content}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
