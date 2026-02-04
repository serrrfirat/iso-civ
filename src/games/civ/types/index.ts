// ============================================================================
// Agent Civilization — Core Type Definitions
// ============================================================================

export type CivId = 'rome' | 'egypt' | 'mongolia';
export type TerrainType = 'plains' | 'forest' | 'mountain' | 'water' | 'desert' | 'hills';
export type UnitType = 'warrior' | 'archer' | 'scout' | 'settler';
export type BuildingType = 'granary' | 'barracks' | 'walls' | 'market' | 'library';
export type TurnPhase = 'diplomacy' | 'planning' | 'resolution' | 'narration' | 'idle';
export type ResourceType = 'gold' | 'food' | 'production' | 'horses';
export type ImprovementType = 'farm' | 'mine' | 'road';
export type RelationshipStatus = 'neutral' | 'friendly' | 'allied' | 'hostile' | 'war';

export interface CivTile {
  x: number;
  y: number;
  terrain: TerrainType;
  resource?: ResourceType;
  ownerId: CivId | null;
  cityId: string | null;
  improvement?: ImprovementType;
  unitId: string | null;
}

export interface Unit {
  id: string;
  type: UnitType;
  ownerId: CivId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  movement: number;
  movementLeft: number;
}

export interface City {
  id: string;
  name: string;
  ownerId: CivId;
  x: number;
  y: number;
  population: number;
  goldPerTurn: number;
  foodPerTurn: number;
  productionPerTurn: number;
  buildings: BuildingType[];
  currentProduction?: {
    type: 'unit' | 'building';
    target: string;
    progress: number;
    cost: number;
  };
  defense: number;
}

export interface Civilization {
  id: CivId;
  name: string;
  leaderName: string;
  color: string;
  secondaryColor: string;
  gold: number;
  cities: string[];
  units: string[];
  knownTiles: string[]; // serializable set of "x,y" strings
  relationships: Record<CivId, RelationshipStatus>;
  personality: string;
  isAlive: boolean;
  score: number;
}

export interface DiplomacyMessage {
  id: string;
  turn: number;
  from: CivId;
  to: CivId | 'all';
  type: 'message' | 'trade_proposal' | 'alliance_proposal' | 'war_declaration' | 'peace_offer';
  content: string;
  response?: 'accepted' | 'rejected';
}

export interface CombatEvent {
  turn: number;
  attackerId: string;
  defenderId: string;
  attackerCiv: CivId;
  defenderCiv: CivId;
  location: { x: number; y: number };
  attackerDamage: number;
  defenderDamage: number;
  attackerDestroyed: boolean;
  defenderDestroyed: boolean;
}

export interface CivGameState {
  id: string;
  turn: number;
  maxTurns: number;
  phase: TurnPhase;
  grid: CivTile[][];
  gridSize: number;
  civilizations: Record<CivId, Civilization>;
  units: Record<string, Unit>;
  cities: Record<string, City>;
  diplomacyLog: DiplomacyMessage[];
  currentNarration: string;
  combatLog: CombatEvent[];
  winner: CivId | null;
}

// Agent action types for structured tool_use
export type AgentAction =
  | { type: 'move_unit'; unitId: string; targetX: number; targetY: number }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'found_city'; settlerId: string; cityName: string }
  | { type: 'build'; cityId: string; target: string; targetType: 'unit' | 'building' }
  | { type: 'improve_tile'; x: number; y: number; improvement: ImprovementType };

// CIV_COLORS for rendering
export const CIV_COLORS: Record<CivId, { primary: string; secondary: string; label: string }> = {
  rome: { primary: '#DC2626', secondary: '#FCA5A5', label: 'Rome' },
  egypt: { primary: '#D97706', secondary: '#FDE68A', label: 'Egypt' },
  mongolia: { primary: '#2563EB', secondary: '#93C5FD', label: 'Mongolia' },
};

// Terrain colors for isometric rendering
export const TERRAIN_COLORS: Record<TerrainType, { top: string; left: string; right: string; stroke: string }> = {
  plains:   { top: '#6B8E23', left: '#556B2F', right: '#7CFC00', stroke: '#4a6118' },
  forest:   { top: '#228B22', left: '#1A6B1A', right: '#2EA82E', stroke: '#145214' },
  mountain: { top: '#808080', left: '#606060', right: '#A0A0A0', stroke: '#505050' },
  water:    { top: '#4A90D9', left: '#3A7BC8', right: '#5AA0E9', stroke: '#2A5F99' },
  desert:   { top: '#DEB887', left: '#C8A270', right: '#F0D0A0', stroke: '#A08060' },
  hills:    { top: '#8FBC8F', left: '#6B9B6B', right: '#A0D0A0', stroke: '#5A8A5A' },
};

// Resource colors for map dots
export const RESOURCE_COLORS: Record<ResourceType, string> = {
  gold: '#FFD700',
  food: '#32CD32',
  production: '#B87333',
  horses: '#8B4513',
};
