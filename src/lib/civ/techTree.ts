// ============================================================================
// Tech Tree System — research tracking and tech unlocking
// ============================================================================

import { CivGameState, Civilization, City } from '@/games/civ/types';
import { ruleset, RulesetTech } from './ruleset';
import { addNotification, addTurnEvent, addCameraEvent } from './civSimulation';

// ============================================================================
// Science calculation
// ============================================================================

/** Calculate total science per turn for a civilization from its buildings */
export function calculateSciencePerTurn(state: CivGameState, civId: string): number {
  const civ = state.civilizations[civId];
  if (!civ) return 0;

  let science = 0;

  for (const cityId of civ.cities) {
    const city = state.cities[cityId];
    if (!city) continue;
    science += city.sciencePerTurn;
  }

  // Civ bonuses
  const civDef = ruleset.getCiv(civId);
  if (civDef?.bonuses?.science) {
    science += civDef.bonuses.science;
  }

  // Base science from population
  for (const cityId of civ.cities) {
    const city = state.cities[cityId];
    if (!city) continue;
    science += Math.floor(city.population * 0.5);
  }

  return Math.max(1, science); // minimum 1 science per turn
}

// ============================================================================
// Research processing
// ============================================================================

/** Process research for a single civilization during end of turn */
export function processResearch(state: CivGameState, civId: string): string[] {
  const civ = state.civilizations[civId];
  if (!civ || !civ.isAlive) return [];

  const events: string[] = [];

  // Update science per turn
  civ.sciencePerTurn = calculateSciencePerTurn(state, civId);

  // If no active research, auto-pick the cheapest researchable tech
  if (!civ.currentResearch) {
    const researchable = ruleset.getResearchableTechs(civ.researchedTechs);
    if (researchable.length > 0) {
      // Sort by cost, pick cheapest
      researchable.sort((a, b) => a.cost - b.cost);
      const tech = researchable[0];
      civ.currentResearch = { techId: tech.id, progress: 0, cost: tech.cost };
    }
  }

  if (!civ.currentResearch) return events;

  // Apply science
  civ.currentResearch.progress += civ.sciencePerTurn;

  // Check if research is complete
  if (civ.currentResearch.progress >= civ.currentResearch.cost) {
    const techId = civ.currentResearch.techId;
    const tech = ruleset.getTech(techId);
    civ.researchedTechs.push(techId);
    civ.currentResearch = null;

    events.push(`${civ.name} discovered ${tech?.name ?? techId}!`);
    addNotification(state, 'tech', `${civ.name} discovered ${tech?.name ?? techId}!`, civId);
    addTurnEvent(state, 'research_completed', `${civ.name} discovered ${tech?.name ?? techId}`, civId);

    // Add camera event for tech completion (center on capital city)
    if (civ.cities.length > 0) {
      const capitalId = civ.cities[0];
      const capital = state.cities[capitalId];
      if (capital) {
        addCameraEvent(state, 'tech_complete', capital.x, capital.y);
      }
    }

    // Check what this tech unlocks
    const newUnits = Object.entries(ruleset.units)
      .filter(([, u]) => u.techReq === techId)
      .map(([id, u]) => u.name);
    const newBuildings = Object.entries(ruleset.buildings)
      .filter(([, b]) => b.techReq === techId)
      .map(([id, b]) => b.name);

    if (newUnits.length > 0) {
      events.push(`  Unlocked units: ${newUnits.join(', ')}`);
    }
    if (newBuildings.length > 0) {
      events.push(`  Unlocked buildings: ${newBuildings.join(', ')}`);
    }

    // Auto-start next research
    const researchable = ruleset.getResearchableTechs(civ.researchedTechs);
    if (researchable.length > 0) {
      researchable.sort((a, b) => a.cost - b.cost);
      const next = researchable[0];
      civ.currentResearch = { techId: next.id, progress: 0, cost: next.cost };
    }
  }

  return events;
}

// ============================================================================
// Tech queries
// ============================================================================

/** Check if a civilization has researched a specific tech */
export function hasTech(civ: Civilization, techId: string): boolean {
  return civ.researchedTechs.includes(techId);
}

/** Check if a unit type is available to a civilization */
export function isUnitAvailable(civ: Civilization, unitId: string): boolean {
  const unit = ruleset.getUnit(unitId);
  if (!unit) return false;
  if (!unit.techReq) return true;
  return hasTech(civ, unit.techReq);
}

/** Check if a building type is available to a civilization */
export function isBuildingAvailable(civ: Civilization, buildingId: string, cityBuildings: string[]): boolean {
  const building = ruleset.getBuilding(buildingId);
  if (!building) return false;
  if (building.isCapital) return false;
  if (building.techReq && !hasTech(civ, building.techReq)) return false;
  if (building.buildingReq && !cityBuildings.includes(building.buildingReq)) return false;
  if (cityBuildings.includes(buildingId)) return false; // already built
  return true;
}

/** Start researching a specific tech (if valid) */
export function setResearch(civ: Civilization, techId: string): boolean {
  const tech = ruleset.getTech(techId);
  if (!tech) return false;
  if (civ.researchedTechs.includes(techId)) return false;
  if (!tech.prereqs.every(p => civ.researchedTechs.includes(p))) return false;

  // Carry over any progress if switching (lose 10% penalty)
  const existingProgress = civ.currentResearch
    ? Math.floor(civ.currentResearch.progress * 0.9)
    : 0;

  civ.currentResearch = {
    techId: tech.id,
    progress: Math.min(existingProgress, tech.cost - 1),
    cost: tech.cost,
  };

  return true;
}

/** Calculate the city's science output from buildings */
export function calculateCitySciencePerTurn(city: City): number {
  let science = 0;
  for (const buildingId of city.buildings) {
    const building = ruleset.getBuilding(buildingId);
    if (building?.effects?.science) {
      science += building.effects.science;
    }
  }
  return science;
}
