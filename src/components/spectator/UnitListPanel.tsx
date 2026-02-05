'use client';

import React, { useState, useMemo } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, Unit, CivId } from '@/games/civ/types';
import { ruleset } from '@/lib/civ/ruleset';

// ============================================================================
// Types
// ============================================================================

interface UnitGroup {
  unitType: string;
  units: Unit[];
}

interface CivUnitSection {
  civId: CivId;
  civName: string;
  civColor: string;
  isAlive: boolean;
  totalUnits: number;
  groups: UnitGroup[];
}

// Unit class to icon mapping
const UNIT_CLASS_ICONS: Record<string, string> = {
  melee: '\u2694\ufe0f',   // crossed swords
  ranged: '\ud83c\udff9', // bow and arrow
  mounted: '\ud83d\udc0e', // horse
  siege: '\ud83d\udca3',   // bomb
  naval: '\u26f5',         // sailboat
  recon: '\ud83d\udc41\ufe0f', // eye
  civil: '\ud83d\udee0\ufe0f', // hammer and wrench
};

function getUnitIcon(unitType: string): string {
  const unitDef = ruleset.units[unitType];
  if (!unitDef) return '?';
  return UNIT_CLASS_ICONS[unitDef.class] ?? '\u2753';
}

// ============================================================================
// Sub-components
// ============================================================================

function HPBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-200 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function UnitStatusBadge({ unit }: { unit: Unit }) {
  if (unit.fortified) {
    return (
      <span className="text-[9px] px-1 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
        Fortified
      </span>
    );
  }
  if (unit.actedThisTurn) {
    return (
      <span className="text-[9px] px-1 py-0.5 rounded bg-gray-700/50 text-gray-400 border border-gray-600/50">
        Acted
      </span>
    );
  }
  return null;
}

function UnitTypeIcon({ unitType }: { unitType: string }) {
  const icon = getUnitIcon(unitType);

  return (
    <span className="text-sm" title={unitType}>
      {icon}
    </span>
  );
}

function UnitRow({ unit, onPanTo }: { unit: Unit; onPanTo: (x: number, y: number) => void }) {
  const unitDef = ruleset.units[unit.type];
  const unitName = unitDef?.name ?? unit.type;

  return (
    <button
      onClick={() => onPanTo(unit.x, unit.y)}
      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700/50 rounded transition-colors text-left group"
    >
      <UnitTypeIcon unitType={unit.type} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-gray-200 truncate group-hover:text-white">
          {unitName}
        </div>
        <div className="flex items-center gap-2">
          <HPBar current={unit.hp} max={unit.maxHp} />
          <span className="text-[9px] text-gray-500">
            {unit.hp}/{unit.maxHp}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[9px] text-gray-400 font-mono">
          ({unit.x},{unit.y})
        </span>
        <UnitStatusBadge unit={unit} />
      </div>
    </button>
  );
}

function UnitGroupSection({
  group,
  civColor,
  onPanTo,
}: {
  group: UnitGroup;
  civColor: string;
  onPanTo: (x: number, y: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const unitDef = ruleset.units[group.unitType];
  const unitName = unitDef?.name ?? group.unitType;
  const icon = getUnitIcon(group.unitType);

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-gray-800/50 rounded text-left"
      >
        <span className="text-[10px] text-gray-500">{isExpanded ? '▼' : '▶'}</span>
        <span className="text-xs">{icon}</span>
        <span className="text-[10px] text-gray-300 font-medium flex-1">{unitName}</span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${civColor}20`, color: civColor }}
        >
          {group.units.length}
        </span>
      </button>
      {isExpanded && (
        <div className="ml-3 border-l border-gray-700/50 pl-1">
          {group.units.map((unit) => (
            <UnitRow key={unit.id} unit={unit} onPanTo={onPanTo} />
          ))}
        </div>
      )}
    </div>
  );
}

function CivSection({
  section,
  onPanTo,
  defaultExpanded,
}: {
  section: CivUnitSection;
  onPanTo: (x: number, y: number) => void;
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-700/50 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/40 transition-colors text-left"
        style={{ borderLeftWidth: '3px', borderLeftColor: section.civColor }}
      >
        <span className="text-[10px] text-gray-500">{isExpanded ? '▼' : '▶'}</span>
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: section.civColor }}
        />
        <span className="text-xs font-semibold text-gray-200 flex-1">
          {section.civName}
        </span>
        {!section.isAlive && (
          <span className="text-[9px] text-red-400 bg-red-900/30 px-1 py-0.5 rounded mr-2">
            ELIMINATED
          </span>
        )}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded"
          style={{ backgroundColor: `${section.civColor}30`, color: section.civColor }}
        >
          {section.totalUnits} units
        </span>
      </button>
      {isExpanded && (
        <div className="px-2 pb-2">
          {section.groups.length === 0 ? (
            <div className="text-[10px] text-gray-500 italic px-2 py-1">No units</div>
          ) : (
            section.groups.map((group) => (
              <UnitGroupSection
                key={group.unitType}
                group={group}
                civColor={section.civColor}
                onPanTo={onPanTo}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UnitListPanel() {
  const { state, perspective, panToGrid } = useCivGame();

  // Build sections data
  const sections = useMemo(() => {
    const civIds = Object.keys(state.civilizations);

    // Filter civs based on perspective
    const filteredCivIds =
      perspective === 'global'
        ? civIds
        : civIds.filter((id) => id === perspective);

    return filteredCivIds.map((civId): CivUnitSection => {
      const civ = state.civilizations[civId];
      const colors = CIV_COLORS[civId] ?? { primary: '#888', secondary: '#CCC', label: civId };

      // Get all units for this civ
      const civUnits = civ.units
        .map((id) => state.units[id])
        .filter((u): u is Unit => !!u);

      // Group by unit type
      const groupMap = new Map<string, Unit[]>();
      for (const unit of civUnits) {
        const existing = groupMap.get(unit.type) ?? [];
        existing.push(unit);
        groupMap.set(unit.type, existing);
      }

      // Sort groups by unit type name
      const groups: UnitGroup[] = Array.from(groupMap.entries())
        .map(([unitType, units]) => ({ unitType, units }))
        .sort((a, b) => a.unitType.localeCompare(b.unitType));

      return {
        civId,
        civName: civ.name,
        civColor: colors.primary,
        isAlive: civ.isAlive,
        totalUnits: civUnits.length,
        groups,
      };
    });
  }, [state.civilizations, state.units, perspective]);

  // Total unit count
  const totalUnits = sections.reduce((sum, s) => sum + s.totalUnits, 0);

  const handlePanTo = (x: number, y: number) => {
    panToGrid(x, y);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header summary */}
      <div className="px-3 py-2 border-b border-gray-700/50 bg-gray-800/30 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-200">
            {perspective === 'global' ? 'All Civilizations' : state.civilizations[perspective]?.name ?? 'Unknown'}
          </span>
          <span className="text-[10px] text-gray-400">{totalUnits} total units</span>
        </div>
      </div>

      {/* Scrollable unit list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {sections.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm italic">
            No civilizations to display
          </div>
        ) : (
          sections.map((section) => (
            <CivSection
              key={section.civId}
              section={section}
              onPanTo={handlePanTo}
              defaultExpanded={perspective !== 'global' || sections.length <= 2}
            />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-gray-700/30 shrink-0">
        <div className="text-[9px] text-gray-500 font-bold mb-1 tracking-wider">LEGEND</div>
        <div className="flex flex-wrap gap-2">
          <div className="text-[8px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
            Fortified
          </div>
          <div className="text-[8px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 border border-gray-600/50">
            Acted
          </div>
          <div className="flex items-center gap-1 text-[8px] text-gray-400">
            <span className="inline-block w-4 h-1.5 bg-green-500 rounded-full" /> HP High
          </div>
          <div className="flex items-center gap-1 text-[8px] text-gray-400">
            <span className="inline-block w-4 h-1.5 bg-yellow-500 rounded-full" /> HP Mid
          </div>
          <div className="flex items-center gap-1 text-[8px] text-gray-400">
            <span className="inline-block w-4 h-1.5 bg-red-500 rounded-full" /> HP Low
          </div>
        </div>
      </div>
    </div>
  );
}
