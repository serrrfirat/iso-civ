'use client';

import React, { useState, useMemo } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS } from '@/games/civ/types';
import { ruleset, RulesetTech } from '@/lib/civ/ruleset';

// ============================================================================
// Types
// ============================================================================

type TechStatus = 'researched' | 'in_progress' | 'available' | 'locked';

interface TechNodeData {
  tech: RulesetTech;
  status: TechStatus;
  progress: number; // 0-1 for in_progress, 1 for researched, 0 otherwise
  unlocks: { units: string[]; buildings: string[] };
}

// ============================================================================
// Constants
// ============================================================================

const ERA_ORDER = ['ancient', 'classical', 'medieval'] as const;

const ERA_STYLES: Record<string, { label: string; headerBg: string; headerText: string; accent: string }> = {
  ancient:   { label: 'ANCIENT ERA',   headerBg: 'bg-amber-900/40',  headerText: 'text-amber-400',  accent: 'border-amber-700/50' },
  classical: { label: 'CLASSICAL ERA', headerBg: 'bg-blue-900/40',   headerText: 'text-blue-400',   accent: 'border-blue-700/50' },
  medieval:  { label: 'MEDIEVAL ERA',  headerBg: 'bg-purple-900/40', headerText: 'text-purple-400', accent: 'border-purple-700/50' },
};

const STATUS_STYLES: Record<TechStatus, { bg: string; border: string; text: string; glow?: string }> = {
  researched:  { bg: 'bg-emerald-900/60',  border: 'border-emerald-500/70', text: 'text-emerald-300' },
  in_progress: { bg: 'bg-sky-900/50',      border: 'border-sky-400',        text: 'text-sky-200',    glow: 'shadow-[0_0_8px_rgba(56,189,248,0.4)]' },
  available:   { bg: 'bg-gray-700/60',      border: 'border-gray-400/60',    text: 'text-gray-200' },
  locked:      { bg: 'bg-gray-800/80',      border: 'border-gray-700/40',    text: 'text-gray-500' },
};

// ============================================================================
// Helper: build unlock map (what each tech unlocks)
// ============================================================================

function buildUnlockMap(): Record<string, { units: string[]; buildings: string[] }> {
  const map: Record<string, { units: string[]; buildings: string[] }> = {};

  for (const tech of Object.values(ruleset.techs)) {
    map[tech.id] = { units: [], buildings: [] };
  }

  for (const [unitId, unit] of Object.entries(ruleset.units)) {
    if (unit.techReq && map[unit.techReq]) {
      map[unit.techReq].units.push(unit.name);
    }
  }

  for (const [buildingId, building] of Object.entries(ruleset.buildings)) {
    if (building.techReq && map[building.techReq]) {
      map[building.techReq].buildings.push(building.name);
    }
  }

  return map;
}

const UNLOCK_MAP = buildUnlockMap();

// ============================================================================
// Sub-components
// ============================================================================

function TechNode({ node }: { node: TechNodeData }) {
  const styles = STATUS_STYLES[node.status];
  const isInProgress = node.status === 'in_progress';

  return (
    <div
      className={`relative rounded border px-2 py-1.5 min-w-[110px] max-w-[130px] transition-all ${styles.bg} ${styles.border} ${styles.glow ?? ''}`}
    >
      {/* Pulsing ring for in-progress */}
      {isInProgress && (
        <div className="absolute inset-0 rounded border border-sky-400/50 animate-pulse pointer-events-none" />
      )}

      {/* Tech name */}
      <div className={`text-[11px] font-semibold leading-tight ${styles.text}`}>
        {node.tech.name}
      </div>

      {/* Cost */}
      <div className="text-[9px] text-gray-400 mt-0.5">
        {node.status === 'researched' ? (
          <span className="text-emerald-400">Researched</span>
        ) : isInProgress ? (
          <span className="text-sky-300">
            {Math.floor(node.progress * 100)}% ({Math.floor(node.progress * node.tech.cost)}/{node.tech.cost})
          </span>
        ) : (
          <span>Cost: {node.tech.cost}</span>
        )}
      </div>

      {/* Progress bar for in-progress */}
      {isInProgress && (
        <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-400 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(node.progress * 100, 100)}%` }}
          />
        </div>
      )}

      {/* Unlocks */}
      {(node.unlocks.units.length > 0 || node.unlocks.buildings.length > 0) && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {node.unlocks.units.map((name) => (
            <span key={name} className="text-[8px] px-1 py-[1px] rounded bg-red-900/40 text-red-300 border border-red-800/30">
              {name}
            </span>
          ))}
          {node.unlocks.buildings.map((name) => (
            <span key={name} className="text-[8px] px-1 py-[1px] rounded bg-yellow-900/40 text-yellow-300 border border-yellow-800/30">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dotted connector line between prerequisite and dependent tech */
function PrereqConnector() {
  return (
    <div className="flex items-center self-center mx-0.5">
      <div className="w-4 border-t border-dashed border-gray-600" />
      <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-gray-600" />
    </div>
  );
}

function CurrentResearchBanner({
  techName,
  progress,
  cost,
  sciencePerTurn,
  civColor,
}: {
  techName: string;
  progress: number;
  cost: number;
  sciencePerTurn: number;
  civColor: string;
}) {
  const pct = Math.min((progress / cost) * 100, 100);
  const turnsLeft = sciencePerTurn > 0 ? Math.ceil((cost - progress) / sciencePerTurn) : Infinity;

  return (
    <div className="mx-3 mb-2 p-2 rounded bg-sky-900/30 border border-sky-700/40">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-xs font-semibold text-sky-200">Researching: {techName}</span>
        </div>
        <span className="text-[10px] text-gray-400">
          {sciencePerTurn} science/turn | {turnsLeft === Infinity ? '...' : `~${turnsLeft} turns`}
        </span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: civColor,
          }}
        />
      </div>
      <div className="text-[9px] text-gray-400 mt-0.5 text-right">
        {progress}/{cost} ({Math.floor(pct)}%)
      </div>
    </div>
  );
}

function EraTechSection({
  era,
  nodes,
  allNodes,
}: {
  era: string;
  nodes: TechNodeData[];
  allNodes: Map<string, TechNodeData>;
}) {
  const eraStyle = ERA_STYLES[era] ?? ERA_STYLES.ancient;

  // Group techs into rows. Techs without prereqs in this era start new rows.
  // Techs with prereqs are placed next to their prerequisite.
  const rows = useMemo(() => {
    const result: TechNodeData[][] = [];
    const placed = new Set<string>();

    // Build a chain: for each tech, find the sequence leading to it
    function buildChain(node: TechNodeData): TechNodeData[] {
      const chain: TechNodeData[] = [node];
      // Look for techs in this era that depend on this one
      for (const n of nodes) {
        if (!placed.has(n.tech.id) && n.tech.prereqs.includes(node.tech.id)) {
          placed.add(n.tech.id);
          chain.push(n);
        }
      }
      return chain;
    }

    // First pass: techs whose prereqs are all from prior eras (root techs of this era)
    const roots = nodes.filter(n =>
      n.tech.prereqs.length === 0 ||
      n.tech.prereqs.every(p => {
        const pNode = allNodes.get(p);
        return pNode && !nodes.includes(pNode);
      })
    );

    for (const root of roots) {
      if (placed.has(root.tech.id)) continue;
      placed.add(root.tech.id);
      result.push(buildChain(root));
    }

    // Remaining techs not yet placed
    for (const n of nodes) {
      if (!placed.has(n.tech.id)) {
        placed.add(n.tech.id);
        result.push([n]);
      }
    }

    return result;
  }, [nodes, allNodes]);

  return (
    <div className="mb-3">
      {/* Era header */}
      <div className={`px-3 py-1 ${eraStyle.headerBg} border-y ${eraStyle.accent}`}>
        <span className={`text-[10px] font-bold tracking-widest ${eraStyle.headerText}`}>
          {eraStyle.label}
        </span>
        <span className="text-[9px] text-gray-500 ml-2">
          {nodes.filter(n => n.status === 'researched').length}/{nodes.length} researched
        </span>
      </div>

      {/* Tech rows */}
      <div className="px-3 py-2 space-y-2">
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-start gap-0.5 flex-wrap">
            {row.map((node, ni) => (
              <React.Fragment key={node.tech.id}>
                {ni > 0 && <PrereqConnector />}
                <TechNode node={node} />
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TechTreePanel() {
  const { state } = useCivGame();
  const civIds = Object.keys(state.civilizations);
  const [selectedCivId, setSelectedCivId] = useState<string>(civIds[0] ?? '');

  const civ = state.civilizations[selectedCivId];

  // Build tech node data for the selected civ
  const { nodesByEra, allNodes } = useMemo(() => {
    if (!civ) return { nodesByEra: {} as Record<string, TechNodeData[]>, allNodes: new Map<string, TechNodeData>() };

    const researchedSet = new Set(civ.researchedTechs);
    const availableSet = new Set(
      ruleset.getResearchableTechs(civ.researchedTechs).map(t => t.id)
    );
    const currentTechId = civ.currentResearch?.techId ?? null;

    const all = new Map<string, TechNodeData>();
    const byEra: Record<string, TechNodeData[]> = {};

    for (const era of ERA_ORDER) {
      const eraTechs = ruleset.techsByEra[era] ?? [];
      byEra[era] = [];

      for (const tech of eraTechs) {
        let status: TechStatus;
        let progress = 0;

        if (researchedSet.has(tech.id)) {
          status = 'researched';
          progress = 1;
        } else if (currentTechId === tech.id) {
          status = 'in_progress';
          progress = civ.currentResearch
            ? civ.currentResearch.cost > 0
              ? civ.currentResearch.progress / civ.currentResearch.cost
              : 0
            : 0;
        } else if (availableSet.has(tech.id)) {
          status = 'available';
        } else {
          status = 'locked';
        }

        const node: TechNodeData = {
          tech,
          status,
          progress,
          unlocks: UNLOCK_MAP[tech.id] ?? { units: [], buildings: [] },
        };

        all.set(tech.id, node);
        byEra[era].push(node);
      }
    }

    return { nodesByEra: byEra, allNodes: all };
  }, [civ]);

  if (!civ) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm italic">
        No civilization selected.
      </div>
    );
  }

  const colors = CIV_COLORS[selectedCivId] ?? { primary: '#888', secondary: '#CCC', label: selectedCivId };
  const currentTech = civ.currentResearch ? ruleset.getTech(civ.currentResearch.techId) : null;

  const totalTechs = Object.keys(ruleset.techs).length;
  const researchedCount = civ.researchedTechs.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Civ selector tabs */}
      <div className="flex border-b border-gray-700 shrink-0">
        {civIds.map(civId => {
          const c = CIV_COLORS[civId] ?? { primary: '#888', secondary: '#CCC', label: civId };
          const isActive = civId === selectedCivId;
          return (
            <button
              key={civId}
              onClick={() => setSelectedCivId(civId)}
              className={`flex-1 px-2 py-1.5 text-[10px] font-bold tracking-wider transition-colors ${
                isActive
                  ? 'bg-gray-800 border-b-2'
                  : 'bg-gray-900 text-gray-500 hover:bg-gray-800/50 hover:text-gray-400'
              }`}
              style={isActive ? { borderBottomColor: c.primary, color: c.primary } : undefined}
            >
              {c.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Research summary bar */}
      <div className="px-3 py-2 border-b border-gray-700/50 bg-gray-800/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
            <span className="text-xs font-semibold text-gray-200">{civ.name}</span>
            {!civ.isAlive && (
              <span className="text-[9px] text-red-400 bg-red-900/30 px-1 py-0.5 rounded">ELIMINATED</span>
            )}
          </div>
          <span className="text-[10px] text-gray-400">
            {researchedCount}/{totalTechs} techs
          </span>
        </div>
        {/* Overall progress bar */}
        <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(researchedCount / totalTechs) * 100}%`,
              backgroundColor: colors.primary,
            }}
          />
        </div>
      </div>

      {/* Current research banner */}
      {civ.currentResearch && currentTech && (
        <div className="shrink-0 pt-2">
          <CurrentResearchBanner
            techName={currentTech.name}
            progress={civ.currentResearch.progress}
            cost={civ.currentResearch.cost}
            sciencePerTurn={civ.sciencePerTurn}
            civColor={colors.primary}
          />
        </div>
      )}

      {!civ.currentResearch && (
        <div className="shrink-0 mx-3 mt-2 mb-1 px-2 py-1.5 rounded bg-gray-800/50 border border-gray-700/50">
          <span className="text-[10px] text-gray-500 italic">No active research</span>
        </div>
      )}

      {/* Scrollable tech tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {ERA_ORDER.map(era => {
          const nodes = nodesByEra[era];
          if (!nodes || nodes.length === 0) return null;
          return (
            <EraTechSection
              key={era}
              era={era}
              nodes={nodes}
              allNodes={allNodes}
            />
          );
        })}

        {/* Legend */}
        <div className="px-3 py-2 border-t border-gray-700/30">
          <div className="text-[9px] text-gray-500 font-bold mb-1 tracking-wider">LEGEND</div>
          <div className="flex flex-wrap gap-2">
            {([
              ['researched', 'Researched', 'bg-emerald-900/60 border-emerald-500/70 text-emerald-300'],
              ['in_progress', 'In Progress', 'bg-sky-900/50 border-sky-400 text-sky-200'],
              ['available', 'Available', 'bg-gray-700/60 border-gray-400/60 text-gray-200'],
              ['locked', 'Locked', 'bg-gray-800/80 border-gray-700/40 text-gray-500'],
            ] as const).map(([, label, classes]) => (
              <div key={label} className={`text-[8px] px-1.5 py-0.5 rounded border ${classes}`}>
                {label}
              </div>
            ))}
            <div className="text-[8px] px-1.5 py-0.5 rounded border bg-red-900/40 border-red-800/30 text-red-300">
              Unit
            </div>
            <div className="text-[8px] px-1.5 py-0.5 rounded border bg-yellow-900/40 border-yellow-800/30 text-yellow-300">
              Building
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
