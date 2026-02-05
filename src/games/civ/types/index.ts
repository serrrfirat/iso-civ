// ============================================================================
// Agent Civilization — Core Type Definitions
// ============================================================================
// Types are string-based to support data-driven ruleset expansion.
// Runtime validation is handled by the ruleset loader.
// ============================================================================

import { ruleset } from '@/lib/civ/ruleset';

export type CivId = string;
export type TerrainType = string;
export type UnitType = string;
export type BuildingType = string;
export type TurnPhase = 'diplomacy' | 'planning' | 'resolution' | 'narration' | 'idle';
export type ResourceType = string;
export type ImprovementType = 'farm' | 'mine' | 'road';
export type RelationshipStatus = 'neutral' | 'friendly' | 'allied' | 'hostile' | 'war';
export type GreatPersonType = 'scientist' | 'artist' | 'general' | 'merchant' | 'engineer';
export type GovernmentType = 'despotism' | 'monarchy' | 'republic' | 'democracy' | 'communism';
export type VictoryType = 'conquest' | 'score' | 'science';

export interface SpaceshipParts {
  booster: boolean;
  cockpit: boolean;
  engine: boolean;
}

export interface TradeRoute {
  id: string;
  fromCityId: string;
  toCityId: string;
  unitId: string;
  turnsRemaining: number;
  goldPerTurn: number;
}

export interface CivTile {
  x: number;
  y: number;
  terrain: TerrainType;
  resource?: ResourceType;
  ownerId: CivId | null;
  cityId: string | null;
  improvement?: ImprovementType;
  improvementProgress?: number;
  unitId: string | null;
  naturalWonderId?: string; // ID of natural wonder on this tile
}

export interface UnitAnimation {
  fromX: number;
  fromY: number;
  startTime: number;
  duration: number;
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
  range?: number; // undefined means melee unit
  animating?: UnitAnimation;
  fortified?: boolean;
  actedThisTurn?: boolean;
  isGreatPerson?: boolean;
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
  sciencePerTurn: number;
  culturePerTurn: number;
  cultureStored: number;
  borderRadius: number;
  buildings: BuildingType[];
  currentProduction?: {
    type: 'unit' | 'building';
    target: string;
    progress: number;
    cost: number;
  };
  defense: number;
  localHappiness: number;
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
  relationships: Record<string, RelationshipStatus>;
  personality: string;
  isAlive: boolean;
  score: number;
  // Tech tree state
  researchedTechs: string[];
  currentResearch: { techId: string; progress: number; cost: number } | null;
  sciencePerTurn: number;
  // Golden Age state
  goldenAgePoints: number;
  goldenAgeTurns: number; // remaining turns of golden age
  goldenAgesCompleted: number; // track how many golden ages have been triggered
  // Great People progress
  greatPeopleProgress: Record<GreatPersonType, number>;
  greatPeopleThresholds: Record<GreatPersonType, number>;
  // Government state
  government: GovernmentType;
  anarchyTurns: number; // remaining turns of anarchy (no production)
  // Happiness and War Weariness
  happiness: number;
  warWeariness: number;
  // Science Victory - Spaceship parts
  spaceshipParts: SpaceshipParts;
  // Combat bonus from Great General ability
  combatBonusTurns?: number; // remaining turns of +10% combat bonus
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

export interface BarbarianCamp {
  id: string;
  x: number;
  y: number;
  strength: number;
}

export interface NaturalWonder {
  id: string;
  name: string;
  x: number;
  y: number;
  bonuses: {
    food?: number;
    gold?: number;
    production?: number;
    culture?: number;
    science?: number;
    faith?: number;
  };
  discoveredBy?: CivId; // First civ to have it in territory gets happiness bonus
}

// Turn event types for the event log
export type TurnEventType =
  | 'move'
  | 'attack'
  | 'build'
  | 'research'
  | 'diplomacy'
  | 'city_founded'
  | 'unit_created'
  | 'building_completed'
  | 'research_completed'
  | 'unit_destroyed'
  | 'improvement'
  | 'city_growth';

export interface TurnEvent {
  id: string;
  turn: number;
  type: TurnEventType;
  message: string;
  civId?: CivId;
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

// Visual combat effect for rendering
export interface CombatEffect {
  id: string;
  attackerX: number;
  attackerY: number;
  defenderX: number;
  defenderY: number;
  damage: number;
  attackerCiv: CivId;
  defenderCiv: CivId;
  timestamp: number;
  defenderDestroyed: boolean;
}

// Notification types for in-game events
export type NotificationType = 'combat' | 'city' | 'tech' | 'diplomacy' | 'unit';

export interface GameNotification {
  id: string;
  turn: number;
  type: NotificationType;
  message: string;
  civId?: CivId;
  location?: { x: number; y: number };
  timestamp: number;
}

export interface CivGameState {
  id: string;
  turn: number;
  maxTurns: number;
  phase: TurnPhase;
  grid: CivTile[][];
  gridSize: number;
  civilizations: Record<string, Civilization>;
  units: Record<string, Unit>;
  cities: Record<string, City>;
  tradeRoutes: Record<string, TradeRoute>;
  naturalWonders: Record<string, NaturalWonder>;
  barbarianCamps: Record<string, BarbarianCamp>;
  barbarianUnits: string[];
  diplomacyLog: DiplomacyMessage[];
  currentNarration: string;
  combatLog: CombatEvent[];
  combatEffects: CombatEffect[];
  notifications: GameNotification[];
  turnEvents: TurnEvent[];
  winner: CivId | null;
  victoryType?: VictoryType;
}

// Agent action types for structured tool_use
export type AgentAction =
  | { type: 'move_unit'; unitId: string; targetX: number; targetY: number }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'ranged_attack'; unitId: string; targetX: number; targetY: number }
  | { type: 'found_city'; settlerId: string; cityName: string }
  | { type: 'build'; cityId: string; target: string; targetType: 'unit' | 'building' }
  | { type: 'build_improvement'; workerId: string; improvement: ImprovementType }
  | { type: 'set_research'; techId: string }
  | { type: 'fortify'; unitId: string }
  | { type: 'upgrade_unit'; unitId: string; targetType: string }
  | { type: 'establish_trade_route'; unitId: string; targetCityId: string }
  | { type: 'change_government'; government: GovernmentType }
  | { type: 'expend_great_person'; unitId: string; ability: 'instant_research' | 'golden_age' | 'combat_bonus' | 'gold_bonus' | 'rush_production' };

// CIV_COLORS — derived from ruleset civilizations data
export const CIV_COLORS: Record<string, { primary: string; secondary: string; label: string }> = (() => {
  const colors: Record<string, { primary: string; secondary: string; label: string }> = {};
  for (const [id, civ] of Object.entries(ruleset.civilizations)) {
    colors[id] = { primary: civ.color, secondary: civ.secondaryColor, label: civ.name };
  }
  colors['barbarians'] = { primary: '#8B0000', secondary: '#4A4A4A', label: 'Barbarians' };
  return colors;
})();

// Terrain colors for isometric rendering
export const TERRAIN_COLORS: Record<string, { top: string; left: string; right: string; stroke: string }> = {
  plains:   { top: '#6B8E23', left: '#556B2F', right: '#7CFC00', stroke: '#4a6118' },
  forest:   { top: '#228B22', left: '#1A6B1A', right: '#2EA82E', stroke: '#145214' },
  mountain: { top: '#808080', left: '#606060', right: '#A0A0A0', stroke: '#505050' },
  water:    { top: '#4A90D9', left: '#3A7BC8', right: '#5AA0E9', stroke: '#2A5F99' },
  desert:   { top: '#DEB887', left: '#C8A270', right: '#F0D0A0', stroke: '#A08060' },
  hills:    { top: '#8FBC8F', left: '#6B9B6B', right: '#A0D0A0', stroke: '#5A8A5A' },
};

// Resource colors for map dots
export const RESOURCE_COLORS: Record<string, string> = {
  gold: '#FFD700',
  food: '#32CD32',
  production: '#B87333',
  horses: '#8B4513',
  iron: '#708090',
};
