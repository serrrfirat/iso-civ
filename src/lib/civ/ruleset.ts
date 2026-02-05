// ============================================================================
// Ruleset Loader — loads and validates all JSON data files at startup
// ============================================================================

import unitsData from '@/data/ruleset/units.json';
import buildingsData from '@/data/ruleset/buildings.json';
import techsData from '@/data/ruleset/techs.json';
import terrainData from '@/data/ruleset/terrain.json';
import civsData from '@/data/ruleset/civilizations.json';
import improvementsData from '@/data/ruleset/improvements.json';
import greatPeopleData from '@/data/ruleset/greatPeople.json';
import naturalWondersData from '@/data/ruleset/naturalWonders.json';
import governmentsData from '@/data/ruleset/governments.json';
import { GreatPersonType, GovernmentType } from '@/games/civ/types';

// ============================================================================
// Types
// ============================================================================

export interface RulesetUnit {
  name: string;
  era: string;
  class: string;
  cost: number;
  attack: number;
  defense: number;
  hp: number;
  movement: number;
  vision: number;
  techReq: string | null;
  obsoleteBy: string | null;
  upgradeCost: number | null;
  resourceReq?: string;
  bonusVs?: string;
  maintenance: number;
  range?: number;
  canEstablishTrade?: boolean;
  isGreatPerson?: boolean;
}

export interface RulesetGreatPerson {
  name: string;
  type: GreatPersonType;
  baseThreshold: number;
  ability: string;
  unitType: string;
}

export interface RulesetBuilding {
  name: string;
  cost: number;
  upkeep: number;
  era: string;
  techReq: string | null;
  effects: Record<string, number>;
  buildingReq?: string;
  isCapital?: boolean;
  isWonder?: boolean;
  popGrowthBonus?: boolean;
}

export interface RulesetTech {
  id: string;
  name: string;
  cost: number;
  prereqs: string[];
}

export interface RulesetTerrain {
  moveCost: number;
  defenseBonus: number;
  food: number;
  production: number;
  gold: number;
  navalOnly?: boolean;
}

export interface RulesetCiv {
  name: string;
  leader: string;
  personality: string;
  color: string;
  secondaryColor: string;
  cityNames: string[];
  startPosition: { x: number; y: number };
  startUnits: string[];
  bonuses: Record<string, number>;
}

export interface RulesetImprovement {
  name: string;
  validTerrain: string[];
  turnsToComplete: number;
  effects: Record<string, number>;
}

export interface RulesetNaturalWonder {
  name: string;
  preferredTerrain: string[];
  bonuses: {
    food?: number;
    gold?: number;
    production?: number;
    culture?: number;
    science?: number;
    faith?: number;
  };
  discoveryBonus: number; // Happiness bonus for first civ to have it in territory
}

export interface RulesetGovernment {
  name: string;
  techReq: string | null;
  effects: {
    goldPerCity?: number;
    tradeBonus?: number;
    unitMaintenanceReduction?: number;
    happinessBonus?: number;
    warWearinessReduction?: number;
    productionBonus?: number;
    noHappinessPenalty?: boolean;
  };
  description: string;
}

// ============================================================================
// Singleton Ruleset
// ============================================================================

class Ruleset {
  readonly units: Record<string, RulesetUnit>;
  readonly buildings: Record<string, RulesetBuilding>;
  readonly techs: Record<string, RulesetTech>;
  readonly techsByEra: Record<string, RulesetTech[]>;
  readonly terrain: Record<string, RulesetTerrain>;
  readonly civilizations: Record<string, RulesetCiv>;
  readonly improvements: Record<string, RulesetImprovement>;
  readonly greatPeople: Record<string, RulesetGreatPerson>;
  readonly naturalWonders: Record<string, RulesetNaturalWonder>;
  readonly governments: Record<GovernmentType, RulesetGovernment>;

  constructor() {
    this.units = unitsData as Record<string, RulesetUnit>;
    this.buildings = buildingsData as Record<string, RulesetBuilding>;
    this.terrain = terrainData as Record<string, RulesetTerrain>;
    this.civilizations = civsData as Record<string, RulesetCiv>;
    this.improvements = improvementsData as Record<string, RulesetImprovement>;
    this.greatPeople = greatPeopleData as Record<string, RulesetGreatPerson>;
    this.naturalWonders = naturalWondersData as Record<string, RulesetNaturalWonder>;
    this.governments = governmentsData as Record<GovernmentType, RulesetGovernment>;

    // Flatten techs from era-grouped format into a flat lookup
    const rawTechs = techsData as Record<string, RulesetTech[]>;
    this.techsByEra = rawTechs;
    this.techs = {};
    for (const era of Object.keys(rawTechs)) {
      for (const tech of rawTechs[era]) {
        this.techs[tech.id] = tech;
      }
    }
  }

  // ── Lookup functions ──

  getUnit(id: string): RulesetUnit | undefined {
    return this.units[id];
  }

  getBuilding(id: string): RulesetBuilding | undefined {
    return this.buildings[id];
  }

  getTech(id: string): RulesetTech | undefined {
    return this.techs[id];
  }

  getTerrain(id: string): RulesetTerrain | undefined {
    return this.terrain[id];
  }

  getCiv(id: string): RulesetCiv | undefined {
    return this.civilizations[id];
  }

  getImprovement(id: string): RulesetImprovement | undefined {
    return this.improvements[id];
  }

  getGreatPerson(id: string): RulesetGreatPerson | undefined {
    return this.greatPeople[id];
  }

  getGreatPersonByType(type: GreatPersonType): RulesetGreatPerson | undefined {
    return Object.values(this.greatPeople).find(gp => gp.type === type);
  }

  getNaturalWonder(id: string): RulesetNaturalWonder | undefined {
    return this.naturalWonders[id];
  }

  getNaturalWonderIds(): string[] {
    return Object.keys(this.naturalWonders);
  }

  getGovernment(id: GovernmentType): RulesetGovernment | undefined {
    return this.governments[id];
  }

  /** Get all governments available to a civ with given researched techs */
  getAvailableGovernments(researchedTechs: string[]): GovernmentType[] {
    const techSet = new Set(researchedTechs);
    return (Object.keys(this.governments) as GovernmentType[])
      .filter(govId => {
        const gov = this.governments[govId];
        return !gov.techReq || techSet.has(gov.techReq);
      });
  }

  // ── Query functions ──

  /** Get all unit IDs available to a civ with a given set of researched techs */
  getAvailableUnits(researchedTechs: string[]): string[] {
    const techSet = new Set(researchedTechs);
    return Object.entries(this.units)
      .filter(([, unit]) => !unit.techReq || techSet.has(unit.techReq))
      .map(([id]) => id);
  }

  /** Get all building IDs available given researched techs and existing buildings */
  getAvailableBuildings(researchedTechs: string[], existingBuildings: string[]): string[] {
    const techSet = new Set(researchedTechs);
    const buildingSet = new Set(existingBuildings);
    return Object.entries(this.buildings)
      .filter(([id, bldg]) => {
        if (bldg.isCapital) return false; // palace is not buildable
        if (buildingSet.has(id)) return false; // already built
        if (bldg.techReq && !techSet.has(bldg.techReq)) return false;
        if (bldg.buildingReq && !buildingSet.has(bldg.buildingReq)) return false;
        return true;
      })
      .map(([id]) => id);
  }

  /** Get all techs that can be researched given current researched techs */
  getResearchableTechs(researchedTechs: string[]): RulesetTech[] {
    const techSet = new Set(researchedTechs);
    return Object.values(this.techs)
      .filter(tech => {
        if (techSet.has(tech.id)) return false; // already researched
        return tech.prereqs.every(p => techSet.has(p)); // all prereqs met
      });
  }

  /** Get terrain movement cost, treating impassable as Infinity */
  getMoveCost(terrainType: string): number {
    const t = this.terrain[terrainType];
    if (!t) return Infinity;
    return t.moveCost >= 999 ? Infinity : t.moveCost;
  }

  /** Get terrain defense bonus */
  getDefenseBonus(terrainType: string): number {
    return this.terrain[terrainType]?.defenseBonus ?? 0;
  }

  /** Get all civ IDs */
  getCivIds(): string[] {
    return Object.keys(this.civilizations);
  }

  /** Get a summary of available content for AI prompts */
  getContentSummary(researchedTechs: string[]): string {
    const availUnits = this.getAvailableUnits(researchedTechs);
    const lines: string[] = [];

    lines.push('AVAILABLE UNITS:');
    for (const id of availUnits) {
      const u = this.units[id];
      lines.push(`  ${id}: ${u.name} (${u.class}, cost:${u.cost}, atk:${u.attack}, def:${u.defense}, hp:${u.hp}, move:${u.movement})`);
    }

    lines.push('\nAVAILABLE BUILDINGS:');
    for (const [id, b] of Object.entries(this.buildings)) {
      if (b.isCapital) continue;
      const techReqStr = b.techReq ? ` [requires: ${b.techReq}]` : '';
      const effectStr = Object.entries(b.effects).map(([k, v]) => `+${v} ${k}`).join(', ');
      lines.push(`  ${id}: ${b.name} (cost:${b.cost}, ${effectStr})${techReqStr}`);
    }

    lines.push('\nRESEARCHABLE TECHS:');
    const researchable = this.getResearchableTechs(researchedTechs);
    for (const t of researchable) {
      const prereqStr = t.prereqs.length > 0 ? ` [requires: ${t.prereqs.join(', ')}]` : '';
      lines.push(`  ${t.id}: ${t.name} (cost:${t.cost})${prereqStr}`);
    }

    return lines.join('\n');
  }
}

/** Singleton ruleset instance */
export const ruleset = new Ruleset();
