import { CivGameState, CivId, AgentAction, Unit, City, NotificationType, GameNotification, TurnEvent, TurnEventType, TradeRoute, GreatPersonType, GovernmentType, CameraEvent, CameraEventType } from '@/games/civ/types';
import { findPath, isInEnemyZoC } from './pathfinding';
import { resolveCombat, resolveCityAttack, resolveRangedCombat } from './combatResolver';
import { ruleset } from './ruleset';
import { processResearch, isUnitAvailable, isBuildingAvailable, calculateCitySciencePerTurn } from './techTree';

// Government anarchy duration in turns
const ANARCHY_DURATION = 5;

// Camera event priority constants (higher = more important)
const CAMERA_PRIORITY = {
  combat: 100,
  city_founded: 80,
  unit_destroyed: 90,
  tech_complete: 60,
} as const;

// ============================================================================
// Resource requirement helper
// ============================================================================

/**
 * Check if a civilization has access to a specific resource in their territory
 * @param state - The current game state
 * @param civId - The civilization ID to check
 * @param resource - The resource type to check for (e.g., 'horses', 'iron')
 * @returns true if the civ has at least one tile with the resource in their territory
 */
export function civHasResource(state: CivGameState, civId: string, resource: string): boolean {
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y][x];
      if (tile.ownerId === civId && tile.resource === resource) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// Turn event helper
// ============================================================================

let nextTurnEventId = 1;

export function addTurnEvent(
  state: CivGameState,
  type: TurnEventType,
  message: string,
  civId?: CivId
): void {
  const event: TurnEvent = {
    id: `event_${nextTurnEventId++}`,
    turn: state.turn,
    type,
    message,
    civId,
  };
  state.turnEvents.push(event);
}

// ============================================================================
// Notification helper
// ============================================================================

let nextNotificationId = 1;

export function addNotification(
  state: CivGameState,
  type: NotificationType,
  message: string,
  civId?: CivId,
  location?: { x: number; y: number }
): void {
  const notification: GameNotification = {
    id: `notif_${nextNotificationId++}`,
    turn: state.turn,
    type,
    message,
    civId,
    location,
    timestamp: Date.now(),
  };
  state.notifications.push(notification);
}

// ============================================================================
// Camera Event Helper
// ============================================================================

/**
 * Add a camera event to trigger auto-pan in the UI
 * @param state - The current game state
 * @param type - The type of camera event
 * @param x - Grid x coordinate
 * @param y - Grid y coordinate
 */
export function addCameraEvent(
  state: CivGameState,
  type: CameraEventType,
  x: number,
  y: number
): void {
  const priority = CAMERA_PRIORITY[type];
  const event: CameraEvent = {
    type,
    x,
    y,
    priority,
  };
  state.cameraEvents.push(event);
}

// ============================================================================
// Trade Route Helper
// ============================================================================

/**
 * Check if a unit is currently on an active trade route (busy and cannot move)
 */
export function isUnitOnTradeRoute(state: CivGameState, unitId: string): boolean {
  for (const route of Object.values(state.tradeRoutes)) {
    if (route.unitId === unitId) return true;
  }
  return false;
}

// ============================================================================
// Action validation & execution
// ============================================================================

export function validateAction(state: CivGameState, action: AgentAction, civId: CivId): boolean {
  const civ = state.civilizations[civId];
  if (!civ) return false;

  switch (action.type) {
    case 'move_unit': {
      const unit = state.units[action.unitId];
      if (!unit || unit.ownerId !== civId) return false;
      if (unit.movementLeft <= 0) return false;
      // Check if unit is on an active trade route (busy caravans can't move)
      if (isUnitOnTradeRoute(state, action.unitId)) return false;
      // Pass unit owner ID to enable Zone of Control checking
      const path = findPath(state, unit.x, unit.y, action.targetX, action.targetY, unit.movementLeft, civId);
      if (!path) return false;

      // Additional ZoC validation: if path goes through tiles adjacent to enemies,
      // verify the target is the first ZoC tile encountered (movement must stop there)
      for (let i = 1; i < path.length; i++) {
        const tile = path[i];
        if (isInEnemyZoC(state, tile.x, tile.y, civId)) {
          // If this tile is in enemy ZoC and it's not the final destination,
          // the move is invalid (must stop at first ZoC tile)
          if (i !== path.length - 1) {
            return false;
          }
          // If it IS the final destination and in ZoC, that's valid
          break;
        }
      }
      return true;
    }
    case 'attack': {
      const attacker = state.units[action.unitId];
      const target = state.units[action.targetId];
      if (!attacker || attacker.ownerId !== civId) return false;
      if (!target || target.ownerId === civId) return false;
      // Must be adjacent
      const dist = Math.abs(attacker.x - target.x) + Math.abs(attacker.y - target.y);
      return dist <= 1;
    }
    case 'found_city': {
      const settler = state.units[action.settlerId];
      if (!settler || settler.ownerId !== civId || settler.type !== 'settler') return false;
      // Can't found on water/mountain or existing city
      const tile = state.grid[settler.y]?.[settler.x];
      if (!tile || tile.terrain === 'water' || tile.terrain === 'mountain') return false;
      if (tile.cityId) return false;
      return true;
    }
    case 'build': {
      const city = state.cities[action.cityId];
      if (!city || city.ownerId !== civId) return false;
      if (city.currentProduction) return false; // already building
      if (action.targetType === 'building') {
        const building = ruleset.getBuilding(action.target);
        if (!building) return false;
        if (!isBuildingAvailable(civ, action.target, city.buildings)) return false;
      } else {
        const unit = ruleset.getUnit(action.target);
        if (!unit) return false;
        if (!isUnitAvailable(civ, action.target)) return false;
        // Check resource requirements for units (e.g., horses for chariot/horseman/knight, iron for swordsman/longswordsman)
        if (unit.resourceReq && !civHasResource(state, civId, unit.resourceReq)) {
          return false;
        }
      }
      return true;
    }
    case 'set_research': {
      const tech = ruleset.getTech(action.techId);
      if (!tech) return false;
      if (civ.researchedTechs.includes(action.techId)) return false;
      return tech.prereqs.every(p => civ.researchedTechs.includes(p));
    }
    case 'build_improvement': {
      const worker = state.units[action.workerId];
      if (!worker || worker.ownerId !== civId || worker.type !== 'worker') return false;
      if (worker.movementLeft <= 0) return false;

      const tile = state.grid[worker.y]?.[worker.x];
      if (!tile) return false;

      // Check if improvement already exists or is being built
      if (tile.improvement) return false;

      // Check if improvement type is valid
      const improvement = ruleset.getImprovement(action.improvement);
      if (!improvement) return false;

      // Check if terrain is valid for this improvement
      if (!improvement.validTerrain.includes(tile.terrain)) return false;

      return true;
    }
    case 'fortify': {
      const unit = state.units[action.unitId];
      if (!unit || unit.ownerId !== civId) return false;
      if (unit.movementLeft <= 0) return false;
      // Settlers and workers cannot fortify
      if (unit.type === 'settler' || unit.type === 'worker') return false;
      return true;
    }
    case 'ranged_attack': {
      const attacker = state.units[action.unitId];
      if (!attacker || attacker.ownerId !== civId) return false;
      if (attacker.movementLeft <= 0) return false;
      // Check if unit has range capability
      const unitDef = ruleset.getUnit(attacker.type);
      if (!unitDef || !unitDef.range) return false;
      // Check Manhattan distance is within range
      const dist = Math.abs(attacker.x - action.targetX) + Math.abs(attacker.y - action.targetY);
      if (dist > unitDef.range) return false;
      // Check target tile has enemy unit
      const targetTile = state.grid[action.targetY]?.[action.targetX];
      if (!targetTile || !targetTile.unitId) return false;
      const targetUnit = state.units[targetTile.unitId];
      if (!targetUnit || targetUnit.ownerId === civId) return false;
      return true;
    }
    case 'upgrade_unit': {
      const unit = state.units[action.unitId];
      if (!unit || unit.ownerId !== civId) return false;

      // Check if unit has an upgrade path
      const unitDef = ruleset.getUnit(unit.type);
      if (!unitDef || !unitDef.obsoleteBy) return false;

      // Check if targetType matches the upgrade path
      if (action.targetType !== unitDef.obsoleteBy) return false;

      // Check if upgrade cost is defined
      if (unitDef.upgradeCost === null || unitDef.upgradeCost === undefined) return false;

      // Check if civ has required tech for the upgraded unit
      const upgradedUnitDef = ruleset.getUnit(action.targetType);
      if (!upgradedUnitDef) return false;
      if (upgradedUnitDef.techReq && !civ.researchedTechs.includes(upgradedUnitDef.techReq)) return false;

      // Check if civ has enough gold
      if (civ.gold < unitDef.upgradeCost) return false;

      return true;
    }
    case 'establish_trade_route': {
      const unit = state.units[action.unitId];
      if (!unit || unit.ownerId !== civId) return false;

      // Check if unit is a caravan (has canEstablishTrade)
      const unitDef = ruleset.getUnit(unit.type);
      if (!unitDef || !unitDef.canEstablishTrade) return false;

      // Check if unit is already on an active trade route
      for (const route of Object.values(state.tradeRoutes)) {
        if (route.unitId === action.unitId) return false;
      }

      // Check if unit is in a city
      const unitTile = state.grid[unit.y]?.[unit.x];
      if (!unitTile || !unitTile.cityId) return false;
      const fromCity = state.cities[unitTile.cityId];
      if (!fromCity || fromCity.ownerId !== civId) return false;

      // Check if target city exists and is different from current city
      const targetCity = state.cities[action.targetCityId];
      if (!targetCity) return false;
      if (targetCity.id === unitTile.cityId) return false;

      return true;
    }
    case 'change_government': {
      // Cannot change to current government
      if (civ.government === action.government) return false;

      // Cannot change while already in anarchy
      if (civ.anarchyTurns > 0) return false;

      // Check if target government exists
      const gov = ruleset.getGovernment(action.government);
      if (!gov) return false;

      // Check if required tech is researched
      if (gov.techReq && !civ.researchedTechs.includes(gov.techReq)) return false;

      return true;
    }
    case 'expend_great_person': {
      const unit = state.units[action.unitId];
      if (!unit || unit.ownerId !== civId) return false;

      // Must be a great person
      if (!unit.isGreatPerson) return false;

      // Verify ability matches the great person type
      const unitDef = ruleset.getUnit(unit.type);
      if (!unitDef) return false;

      // Map great person types to valid abilities
      const abilityMap: Record<string, string> = {
        'great_scientist': 'instant_research',
        'great_artist': 'golden_age',
        'great_general': 'combat_bonus',
        'great_merchant': 'gold_bonus',
        'great_engineer': 'rush_production',
      };

      const expectedAbility = abilityMap[unit.type];
      if (action.ability !== expectedAbility) return false;

      // Additional validation for specific abilities
      if (action.ability === 'instant_research') {
        // Must have active research
        if (!civ.currentResearch) return false;
      }

      if (action.ability === 'rush_production') {
        // Must have at least one city with active production
        let hasActiveProduction = false;
        for (const cityId of civ.cities) {
          const city = state.cities[cityId];
          if (city && city.currentProduction) {
            hasActiveProduction = true;
            break;
          }
        }
        if (!hasActiveProduction) return false;
      }

      return true;
    }
    default:
      return false;
  }
}

let nextSpawnedUnitId = 100;
let nextSpawnedCityId = 100;

export function executeAction(state: CivGameState, action: AgentAction, civId: CivId, seed: number): string[] {
  const events: string[] = [];

  switch (action.type) {
    case 'move_unit': {
      const unit = state.units[action.unitId];
      if (!unit) break;
      // Pass unit owner ID to enable Zone of Control checking
      const path = findPath(state, unit.x, unit.y, action.targetX, action.targetY, unit.movementLeft, unit.ownerId);
      if (!path || path.length < 2) break;

      // Clear fortified status when moving
      unit.fortified = false;

      // Store old position for animation
      const oldX = unit.x;
      const oldY = unit.y;

      // Remove from old tile
      state.grid[unit.y][unit.x].unitId = null;

      // Move along path
      const dest = path[path.length - 1];
      let moveCost = 0;
      for (let i = 1; i < path.length; i++) {
        const tile = state.grid[path[i].y][path[i].x];
        // Check if tile has a road improvement - roads reduce movement cost to 0.5
        if (tile.improvement === 'road') {
          moveCost += 0.5;
        } else {
          moveCost += ruleset.getMoveCost(tile.terrain);
        }
      }

      // Set animation state before updating position
      unit.animating = {
        fromX: oldX,
        fromY: oldY,
        startTime: Date.now(),
        duration: 500, // 500ms animation
      };

      unit.x = dest.x;
      unit.y = dest.y;
      unit.movementLeft = Math.max(0, unit.movementLeft - moveCost);

      // Place on new tile
      state.grid[unit.y][unit.x].unitId = unit.id;

      // Reveal fog of war
      const unitDef = ruleset.getUnit(unit.type);
      const range = unitDef?.vision ?? 2;
      const civ = state.civilizations[civId];
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          const nx = unit.x + dx;
          const ny = unit.y + dy;
          if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
            const key = `${nx},${ny}`;
            if (!civ.knownTiles.includes(key)) {
              civ.knownTiles.push(key);
            }
          }
        }
      }

      // Mark unit as having acted this turn (prevents healing)
      unit.actedThisTurn = true;

      events.push(`${civId} moved ${unit.type} to (${dest.x}, ${dest.y})`);
      addTurnEvent(state, 'move', `${state.civilizations[civId]?.name || civId} moved ${unit.type} from (${oldX}, ${oldY}) to (${dest.x}, ${dest.y})`, civId);
      break;
    }

    case 'attack': {
      const attacker = state.units[action.unitId];
      const defender = state.units[action.targetId];
      if (!attacker || !defender) break;

      // Store positions before combat (in case units are destroyed)
      const attackerX = attacker.x;
      const attackerY = attacker.y;
      const defenderX = defender.x;
      const defenderY = defender.y;

      const result = resolveCombat(state, action.unitId, action.targetId, seed);
      if (!result) break;

      events.push(`${result.attackerCiv} attacked ${result.defenderCiv}: ${result.defenderDamage} damage dealt, ${result.attackerDamage} received`);
      addTurnEvent(state, 'attack', `${state.civilizations[result.attackerCiv]?.name || result.attackerCiv} attacked ${state.civilizations[result.defenderCiv]?.name || result.defenderCiv}: ${result.defenderDamage} damage dealt, ${result.attackerDamage} received`, result.attackerCiv);

      // Increase war weariness for both civs (+1 per combat)
      const attackerCivState = state.civilizations[result.attackerCiv];
      const defenderCivState = state.civilizations[result.defenderCiv];
      if (attackerCivState) attackerCivState.warWeariness += 1;
      if (defenderCivState) defenderCivState.warWeariness += 1;

      // Add visual combat effect
      const combatEffect = {
        id: `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        attackerX,
        attackerY,
        defenderX,
        defenderY,
        damage: result.defenderDamage,
        attackerCiv: result.attackerCiv,
        defenderCiv: result.defenderCiv,
        timestamp: Date.now(),
        defenderDestroyed: result.defenderDestroyed,
      };
      state.combatEffects.push(combatEffect);

      // Add camera event for combat (center on defender position)
      addCameraEvent(state, 'combat', defenderX, defenderY);

      if (result.defenderDestroyed) {
        const def = state.units[action.targetId];
        if (def) {
          const defUnitType = def.type;
          state.grid[def.y][def.x].unitId = null;
          const defCiv = state.civilizations[def.ownerId];
          defCiv.units = defCiv.units.filter(id => id !== action.targetId);
          // Increase war weariness for unit lost (+5)
          defCiv.warWeariness += 5;
          delete state.units[action.targetId];
          events.push(`${result.defenderCiv}'s ${defUnitType} was destroyed`);
          addNotification(state, 'combat', `${defCiv.name}'s ${defUnitType} was destroyed in combat!`, result.defenderCiv, { x: defenderX, y: defenderY });
          addTurnEvent(state, 'unit_destroyed', `${state.civilizations[result.defenderCiv]?.name || result.defenderCiv}'s ${defUnitType} was destroyed at (${defenderX}, ${defenderY})`, result.defenderCiv);
          // Add camera event for unit destruction
          addCameraEvent(state, 'unit_destroyed', defenderX, defenderY);
        }
      }

      if (result.attackerDestroyed) {
        const atk = state.units[action.unitId];
        if (atk) {
          const atkUnitType = atk.type;
          state.grid[atk.y][atk.x].unitId = null;
          const atkCiv = state.civilizations[atk.ownerId];
          atkCiv.units = atkCiv.units.filter(id => id !== action.unitId);
          // Increase war weariness for unit lost (+5)
          atkCiv.warWeariness += 5;
          delete state.units[action.unitId];
          events.push(`${result.attackerCiv}'s ${atkUnitType} was destroyed`);
          addNotification(state, 'combat', `${atkCiv.name}'s ${atkUnitType} was destroyed in combat!`, result.attackerCiv, { x: attackerX, y: attackerY });
          // Add camera event for unit destruction
          addCameraEvent(state, 'unit_destroyed', attackerX, attackerY);
          addTurnEvent(state, 'unit_destroyed', `${state.civilizations[result.attackerCiv]?.name || result.attackerCiv}'s ${atkUnitType} was destroyed at (${attackerX}, ${attackerY})`, result.attackerCiv);
        }
      }

      // Mark attacker as having acted this turn (prevents healing)
      // Note: attacker may have been destroyed, so check if it still exists
      if (state.units[action.unitId]) {
        state.units[action.unitId].actedThisTurn = true;
      }

      state.combatLog.push(result);
      break;
    }

    case 'found_city': {
      const settler = state.units[action.settlerId];
      if (!settler) break;

      const cityId = `c${nextSpawnedCityId++}`;
      const city: City = {
        id: cityId, name: action.cityName, ownerId: civId,
        x: settler.x, y: settler.y, population: 1,
        goldPerTurn: 2, foodPerTurn: 1, productionPerTurn: 1,
        sciencePerTurn: 0,
        culturePerTurn: 1,
        cultureStored: 0,
        borderRadius: 1,
        buildings: [], defense: 5,
        localHappiness: 0,
      };
      state.cities[cityId] = city;
      state.grid[settler.y][settler.x].cityId = cityId;
      state.grid[settler.y][settler.x].ownerId = civId;

      // Claim territory within initial border radius (1)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = settler.x + dx;
          const ny = settler.y + dy;
          if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
            if (Math.abs(dx) + Math.abs(dy) <= 1 && !state.grid[ny][nx].ownerId) {
              state.grid[ny][nx].ownerId = civId;
            }
          }
        }
      }

      // Remove settler
      state.grid[settler.y][settler.x].unitId = null;
      const civ = state.civilizations[civId];
      civ.units = civ.units.filter(id => id !== action.settlerId);
      civ.cities.push(cityId);
      delete state.units[action.settlerId];

      events.push(`${civId} founded ${action.cityName}`);
      addNotification(state, 'city', `${civ.name} founded ${action.cityName}!`, civId, { x: city.x, y: city.y });
      addTurnEvent(state, 'city_founded', `${state.civilizations[civId]?.name || civId} founded ${action.cityName} at (${settler.x}, ${settler.y})`, civId);
      // Add camera event for city founding
      addCameraEvent(state, 'city_founded', city.x, city.y);
      break;
    }

    case 'build': {
      const city = state.cities[action.cityId];
      if (!city) break;

      let cost: number;
      if (action.targetType === 'building') {
        const building = ruleset.getBuilding(action.target);
        cost = building?.cost ?? 50;
      } else {
        const unit = ruleset.getUnit(action.target);
        cost = unit?.cost ?? 30;
      }

      city.currentProduction = {
        type: action.targetType,
        target: action.target,
        progress: 0,
        cost,
      };

      events.push(`${civId}'s ${city.name} started building ${action.target}`);
      addTurnEvent(state, 'build', `${state.civilizations[civId]?.name || civId}'s ${city.name} started building ${action.target}`, civId);
      break;
    }

    case 'set_research': {
      const civ = state.civilizations[civId];
      const tech = ruleset.getTech(action.techId);
      if (civ && tech) {
        civ.currentResearch = { techId: action.techId, progress: 0, cost: tech.cost };
        events.push(`${civId} started researching ${tech.name}`);
        addTurnEvent(state, 'research', `${civ.name} started researching ${tech.name}`, civId);
      }
      break;
    }

    case 'build_improvement': {
      const worker = state.units[action.workerId];
      if (!worker) break;

      const tile = state.grid[worker.y][worker.x];
      const improvement = ruleset.getImprovement(action.improvement);
      if (!tile || !improvement) break;

      // Start or continue building the improvement
      if (tile.improvementProgress === undefined) {
        // Starting new improvement
        tile.improvementProgress = 1;
        events.push(`${civId}'s worker started building ${improvement.name} at (${worker.x}, ${worker.y})`);
      } else {
        // Continue building
        tile.improvementProgress++;
        events.push(`${civId}'s worker continues building ${improvement.name} at (${worker.x}, ${worker.y}) (${tile.improvementProgress}/${improvement.turnsToComplete})`);
      }

      // Check if improvement is complete
      if (tile.improvementProgress >= improvement.turnsToComplete) {
        tile.improvement = action.improvement;
        tile.improvementProgress = undefined;
        events.push(`${civId} completed ${improvement.name} at (${worker.x}, ${worker.y})`);
        addTurnEvent(state, 'improvement', `${state.civilizations[civId]?.name || civId} completed ${improvement.name} at (${worker.x}, ${worker.y})`, civId);
      } else {
        addTurnEvent(state, 'improvement', `${state.civilizations[civId]?.name || civId}'s worker is building ${improvement.name} at (${worker.x}, ${worker.y})`, civId);
      }

      // Worker uses all movement when building
      worker.movementLeft = 0;
      break;
    }

    case 'fortify': {
      const unit = state.units[action.unitId];
      if (!unit) break;

      // Set fortified status and use all movement
      unit.fortified = true;
      unit.movementLeft = 0;

      events.push(`${civId}'s ${unit.type} fortified at (${unit.x}, ${unit.y})`);
      break;
    }

    case 'ranged_attack': {
      const attacker = state.units[action.unitId];
      if (!attacker) break;

      // Find defender from target coordinates
      const targetTile = state.grid[action.targetY]?.[action.targetX];
      if (!targetTile || !targetTile.unitId) break;
      const defenderId = targetTile.unitId;
      const defender = state.units[defenderId];
      if (!defender) break;

      // Store positions for combat effect
      const attackerX = attacker.x;
      const attackerY = attacker.y;
      const defenderX = defender.x;
      const defenderY = defender.y;

      const result = resolveRangedCombat(state, action.unitId, defenderId, seed);
      if (!result) break;

      events.push(`${result.attackerCiv} ranged attacked ${result.defenderCiv}: ${result.defenderDamage} damage dealt (no retaliation)`);
      addTurnEvent(state, 'attack', `${state.civilizations[result.attackerCiv]?.name || result.attackerCiv} ranged attacked ${state.civilizations[result.defenderCiv]?.name || result.defenderCiv}: ${result.defenderDamage} damage dealt`, result.attackerCiv);

      // Increase war weariness for both civs (+1 per combat)
      const rangedAttackerCiv = state.civilizations[result.attackerCiv];
      const rangedDefenderCiv = state.civilizations[result.defenderCiv];
      if (rangedAttackerCiv) rangedAttackerCiv.warWeariness += 1;
      if (rangedDefenderCiv) rangedDefenderCiv.warWeariness += 1;

      // Add visual combat effect
      const combatEffect = {
        id: `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        attackerX,
        attackerY,
        defenderX,
        defenderY,
        damage: result.defenderDamage,
        attackerCiv: result.attackerCiv,
        defenderCiv: result.defenderCiv,
        timestamp: Date.now(),
        defenderDestroyed: result.defenderDestroyed,
      };
      state.combatEffects.push(combatEffect);

      // Add camera event for ranged combat (center on defender position)
      addCameraEvent(state, 'combat', defenderX, defenderY);

      if (result.defenderDestroyed) {
        const def = state.units[defenderId];
        if (def) {
          const defUnitType = def.type;
          state.grid[def.y][def.x].unitId = null;
          const defCiv = state.civilizations[def.ownerId];
          defCiv.units = defCiv.units.filter(id => id !== defenderId);
          // Increase war weariness for unit lost (+5)
          defCiv.warWeariness += 5;
          delete state.units[defenderId];
          events.push(`${result.defenderCiv}'s ${defUnitType} was destroyed`);
          addNotification(state, 'unit', `${defCiv.name}'s ${defUnitType} was destroyed!`, result.defenderCiv, { x: defenderX, y: defenderY });
          addTurnEvent(state, 'unit_destroyed', `${state.civilizations[result.defenderCiv]?.name || result.defenderCiv}'s ${defUnitType} was destroyed at (${defenderX}, ${defenderY})`, result.defenderCiv);
          // Add camera event for unit destruction
          addCameraEvent(state, 'unit_destroyed', defenderX, defenderY);
        }
      }

      // Mark attacker as having acted and use all movement
      if (state.units[action.unitId]) {
        state.units[action.unitId].actedThisTurn = true;
        state.units[action.unitId].movementLeft = 0;
      }

      state.combatLog.push(result);
      break;
    }

    case 'upgrade_unit': {
      const unit = state.units[action.unitId];
      if (!unit) break;

      const civ = state.civilizations[civId];
      const oldUnitDef = ruleset.getUnit(unit.type);
      if (!oldUnitDef || !oldUnitDef.obsoleteBy || oldUnitDef.upgradeCost === null) break;

      // Verify targetType matches the upgrade path
      if (action.targetType !== oldUnitDef.obsoleteBy) break;

      const newUnitDef = ruleset.getUnit(action.targetType);
      if (!newUnitDef) break;

      // Deduct gold cost
      civ.gold -= oldUnitDef.upgradeCost;

      // Calculate HP percentage to preserve
      const hpPercentage = unit.hp / unit.maxHp;

      // Store old unit type for logging
      const oldType = unit.type;

      // Upgrade the unit - change type and update stats
      unit.type = action.targetType;
      unit.maxHp = newUnitDef.hp;
      unit.hp = Math.max(1, Math.round(newUnitDef.hp * hpPercentage)); // Keep HP percentage, min 1
      unit.attack = newUnitDef.attack;
      unit.defense = newUnitDef.defense;
      unit.movement = newUnitDef.movement;
      // Don't reset movementLeft - unit keeps remaining movement

      events.push(`${civId} upgraded ${oldType} to ${unit.type} for ${oldUnitDef.upgradeCost} gold`);
      addTurnEvent(state, 'build', `${civ.name} upgraded ${oldType} to ${unit.type} at (${unit.x}, ${unit.y})`, civId);
      break;
    }

    case 'establish_trade_route': {
      const unit = state.units[action.unitId];
      if (!unit) break;

      const unitTile = state.grid[unit.y]?.[unit.x];
      if (!unitTile || !unitTile.cityId) break;

      const fromCity = state.cities[unitTile.cityId];
      const targetCity = state.cities[action.targetCityId];
      if (!fromCity || !targetCity) break;

      // Calculate distance (Manhattan distance) between cities
      const distance = Math.abs(fromCity.x - targetCity.x) + Math.abs(fromCity.y - targetCity.y);

      // Calculate gold per turn based on distance (minimum 2, +1 per 3 tiles)
      const goldPerTurn = Math.max(2, Math.floor(distance / 3) + 2);

      // Trade route duration: 10 turns
      const turnsRemaining = 10;

      // Create trade route
      const routeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tradeRoute: TradeRoute = {
        id: routeId,
        fromCityId: fromCity.id,
        toCityId: targetCity.id,
        unitId: unit.id,
        turnsRemaining,
        goldPerTurn,
      };
      state.tradeRoutes[routeId] = tradeRoute;

      // Mark unit as acting (uses all movement)
      unit.movementLeft = 0;
      unit.actedThisTurn = true;

      const civ = state.civilizations[civId];
      events.push(`${civId} established trade route from ${fromCity.name} to ${targetCity.name} (${goldPerTurn} gold/turn for ${turnsRemaining} turns)`);
      addNotification(state, 'city', `${civ.name} established trade route from ${fromCity.name} to ${targetCity.name}!`, civId, { x: fromCity.x, y: fromCity.y });
      addTurnEvent(state, 'diplomacy', `${civ.name} established trade route from ${fromCity.name} to ${targetCity.name} (${goldPerTurn} gold/turn)`, civId);
      break;
    }

    case 'change_government': {
      const civ = state.civilizations[civId];
      if (!civ) break;

      const oldGov = ruleset.getGovernment(civ.government);
      const newGov = ruleset.getGovernment(action.government);
      if (!newGov) break;

      const oldGovName = oldGov?.name || civ.government;
      const newGovName = newGov.name;

      // Change government and start anarchy period
      civ.government = action.government;
      civ.anarchyTurns = ANARCHY_DURATION;

      events.push(`${civ.name} changed government from ${oldGovName} to ${newGovName}. ${ANARCHY_DURATION} turns of anarchy begin.`);
      addNotification(state, 'diplomacy', `${civ.name} has changed to ${newGovName}! ${ANARCHY_DURATION} turns of anarchy.`, civId);
      addTurnEvent(state, 'diplomacy', `${civ.name} adopted ${newGovName} government`, civId);
      break;
    }

    case 'expend_great_person': {
      const unit = state.units[action.unitId];
      if (!unit) break;

      const civ = state.civilizations[civId];
      if (!civ) break;

      const unitTypeName = unit.type;

      // Execute ability based on type
      switch (action.ability) {
        case 'instant_research': {
          // Great Scientist: complete current research immediately
          if (civ.currentResearch) {
            const tech = ruleset.getTech(civ.currentResearch.techId);
            const techName = tech?.name || civ.currentResearch.techId;

            // Complete the research
            civ.researchedTechs.push(civ.currentResearch.techId);
            civ.currentResearch = null;

            events.push(`${civ.name}'s Great Scientist completed research on ${techName}!`);
            addNotification(state, 'tech', `Great Scientist completed research on ${techName}!`, civId);
            addTurnEvent(state, 'research_completed', `${civ.name}'s Great Scientist completed ${techName}`, civId);
          }
          break;
        }

        case 'golden_age': {
          // Great Artist: trigger 8 turns of golden age
          const GREAT_ARTIST_GOLDEN_AGE_DURATION = 8;
          civ.goldenAgeTurns = Math.max(civ.goldenAgeTurns, GREAT_ARTIST_GOLDEN_AGE_DURATION);
          civ.goldenAgesCompleted++;

          events.push(`${civ.name}'s Great Artist triggered a Golden Age for ${GREAT_ARTIST_GOLDEN_AGE_DURATION} turns!`);
          addNotification(state, 'city', `Great Artist triggered a Golden Age! (+50% production and gold for ${GREAT_ARTIST_GOLDEN_AGE_DURATION} turns)`, civId);
          addTurnEvent(state, 'city_growth', `${civ.name}'s Great Artist triggered a Golden Age`, civId);
          break;
        }

        case 'combat_bonus': {
          // Great General: give all units +10% combat for 10 turns
          const GREAT_GENERAL_COMBAT_BONUS_DURATION = 10;
          civ.combatBonusTurns = GREAT_GENERAL_COMBAT_BONUS_DURATION;

          events.push(`${civ.name}'s Great General inspired the troops! +10% combat strength for ${GREAT_GENERAL_COMBAT_BONUS_DURATION} turns!`);
          addNotification(state, 'unit', `Great General provides +10% combat bonus for ${GREAT_GENERAL_COMBAT_BONUS_DURATION} turns!`, civId);
          addTurnEvent(state, 'unit_created', `${civ.name}'s Great General inspired the troops`, civId);
          break;
        }

        case 'gold_bonus': {
          // Great Merchant: gain 500 gold instantly
          const GREAT_MERCHANT_GOLD_BONUS = 500;
          civ.gold += GREAT_MERCHANT_GOLD_BONUS;

          events.push(`${civ.name}'s Great Merchant conducted a trade mission and gained ${GREAT_MERCHANT_GOLD_BONUS} gold!`);
          addNotification(state, 'city', `Great Merchant gained ${GREAT_MERCHANT_GOLD_BONUS} gold!`, civId);
          addTurnEvent(state, 'diplomacy', `${civ.name}'s Great Merchant gained ${GREAT_MERCHANT_GOLD_BONUS} gold`, civId);
          break;
        }

        case 'rush_production': {
          // Great Engineer: complete current production in a city
          // Find the first city with active production and complete it
          for (const cityId of civ.cities) {
            const city = state.cities[cityId];
            if (city && city.currentProduction) {
              const productionTarget = city.currentProduction.target;

              // Complete the production
              city.currentProduction.progress = city.currentProduction.cost;

              events.push(`${civ.name}'s Great Engineer rushed production of ${productionTarget} in ${city.name}!`);
              addNotification(state, 'city', `Great Engineer rushed production of ${productionTarget} in ${city.name}!`, civId, { x: city.x, y: city.y });
              addTurnEvent(state, 'building_completed', `${civ.name}'s Great Engineer rushed ${productionTarget} in ${city.name}`, civId);
              break;
            }
          }
          break;
        }
      }

      // Remove the great person unit after expending
      state.grid[unit.y][unit.x].unitId = null;
      civ.units = civ.units.filter(id => id !== action.unitId);
      delete state.units[action.unitId];

      events.push(`${civ.name}'s ${unitTypeName} was expended`);
      break;
    }
  }

  return events;
}

// ============================================================================
// Golden Age processing
// ============================================================================

const GOLDEN_AGE_BASE_THRESHOLD = 100;
const GOLDEN_AGE_THRESHOLD_INCREMENT = 50;
const GOLDEN_AGE_DURATION = 10;
const GOLDEN_AGE_PRODUCTION_BONUS = 0.5; // +50%
const GOLDEN_AGE_GOLD_BONUS = 0.5; // +50%

/**
 * Check if a civilization is currently in a golden age
 */
export function isInGoldenAge(state: CivGameState, civId: CivId): boolean {
  const civ = state.civilizations[civId];
  return civ ? civ.goldenAgeTurns > 0 : false;
}

/**
 * Get the golden age threshold for a civilization based on how many golden ages they've had
 */
export function getGoldenAgeThreshold(goldenAgesCompleted: number): number {
  return GOLDEN_AGE_BASE_THRESHOLD + GOLDEN_AGE_THRESHOLD_INCREMENT * goldenAgesCompleted;
}

/**
 * Process golden age points accumulation and trigger/decrement golden ages
 */
function processGoldenAge(state: CivGameState, civId: CivId): string[] {
  const events: string[] = [];
  const civ = state.civilizations[civId];
  if (!civ || !civ.isAlive) return events;

  // Decrement golden age turns if active
  if (civ.goldenAgeTurns > 0) {
    civ.goldenAgeTurns--;
    if (civ.goldenAgeTurns === 0) {
      events.push(`${civ.name}'s Golden Age has ended!`);
      addNotification(state, 'city', `${civ.name}'s Golden Age has ended!`, civId);
      addTurnEvent(state, 'city_growth', `${civ.name}'s Golden Age ended`, civId);
    }
    return events; // Don't accumulate points during a golden age
  }

  // Accumulate golden age points from cities (culturePerTurn / 2)
  let totalCulturePoints = 0;
  for (const cityId of civ.cities) {
    const city = state.cities[cityId];
    if (!city) continue;
    totalCulturePoints += Math.floor(city.culturePerTurn / 2);
  }
  civ.goldenAgePoints += totalCulturePoints;

  // Check if threshold is reached
  const threshold = getGoldenAgeThreshold(civ.goldenAgesCompleted);
  if (civ.goldenAgePoints >= threshold) {
    // Trigger golden age
    civ.goldenAgePoints = 0;
    civ.goldenAgeTurns = GOLDEN_AGE_DURATION;
    civ.goldenAgesCompleted++;

    events.push(`${civ.name} has entered a Golden Age!`);
    addNotification(state, 'city', `${civ.name} has entered a Golden Age! (+50% production and gold for ${GOLDEN_AGE_DURATION} turns)`, civId);
    addTurnEvent(state, 'city_growth', `${civ.name} entered a Golden Age`, civId);
  }

  return events;
}

// ============================================================================
// Turn resolution: economy, production, research, win conditions
// ============================================================================

export function processEndOfTurn(state: CivGameState): string[] {
  const events: string[] = [];
  const civIds = Object.keys(state.civilizations);

  // Reset actedThisTurn for all units at start of turn processing
  for (const unitId of Object.keys(state.units)) {
    const unit = state.units[unitId];
    if (unit) {
      unit.actedThisTurn = false;
    }
  }

  for (const civId of civIds) {
    const civ = state.civilizations[civId];
    if (!civ.isAlive) continue;

    // Get government bonuses
    const gov = ruleset.getGovernment(civ.government);
    const isInAnarchy = civ.anarchyTurns > 0;

    // Process anarchy: decrement turns
    if (isInAnarchy) {
      civ.anarchyTurns--;
      if (civ.anarchyTurns === 0) {
        events.push(`${civ.name}'s anarchy has ended!`);
        addNotification(state, 'diplomacy', `${civ.name}'s anarchy has ended! ${gov?.name || civ.government} government is now in effect.`, civId);
      }
    }

    // Process combat bonus from Great General: decrement turns
    if (civ.combatBonusTurns && civ.combatBonusTurns > 0) {
      civ.combatBonusTurns--;
      if (civ.combatBonusTurns === 0) {
        events.push(`${civ.name}'s combat bonus from Great General has expired.`);
        addNotification(state, 'unit', `${civ.name}'s combat bonus from Great General has expired.`, civId);
      }
    }

    // Collect gold income (with golden age bonus and government bonus)
    let totalGold = 0;
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city) continue;
      totalGold += city.goldPerTurn;

      // Apply government gold per city bonus (e.g., monarchy) - only if not in anarchy
      if (!isInAnarchy && gov?.effects?.goldPerCity) {
        totalGold += gov.effects.goldPerCity;
      }
    }
    // Apply golden age bonus to gold income
    if (isInGoldenAge(state, civId)) {
      totalGold = Math.floor(totalGold * (1 + GOLDEN_AGE_GOLD_BONUS));
    }
    civ.gold += totalGold;

    // Collect gold from active trade routes owned by this civ
    for (const routeId of Object.keys(state.tradeRoutes)) {
      const route = state.tradeRoutes[routeId];
      const unit = state.units[route.unitId];
      if (unit && unit.ownerId === civId) {
        let tradeGold = route.goldPerTurn;
        // Apply government trade bonus (e.g., Republic: +2 gold per trade route) - only if not in anarchy
        if (!isInAnarchy && gov?.effects?.tradeBonus) {
          tradeGold += gov.effects.tradeBonus;
        }
        civ.gold += tradeGold;
        const fromCity = state.cities[route.fromCityId];
        const toCity = state.cities[route.toCityId];
        if (fromCity && toCity) {
          events.push(`${civ.name}'s trade route ${fromCity.name} -> ${toCity.name} generated ${tradeGold} gold`);
        }
      }
    }

    // Calculate and deduct building upkeep
    let totalUpkeep = 0;
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city) continue;
      for (const buildingId of city.buildings) {
        const building = ruleset.getBuilding(buildingId);
        if (building) {
          totalUpkeep += building.upkeep;
        }
      }
    }
    civ.gold -= totalUpkeep;

    // Deduct unit maintenance costs (with government reduction)
    let totalUnitMaintenance = 0;
    for (const unitId of civ.units) {
      const unit = state.units[unitId];
      if (!unit) continue;
      const unitDef = ruleset.getUnit(unit.type);
      if (unitDef) {
        let maintenance = unitDef.maintenance;
        // Apply republic's unit maintenance reduction - only if not in anarchy
        if (!isInAnarchy && gov?.effects?.unitMaintenanceReduction) {
          maintenance = Math.max(0, maintenance - gov.effects.unitMaintenanceReduction);
        }
        totalUnitMaintenance += maintenance;
      }
    }
    civ.gold -= totalUnitMaintenance;

    // Apply attrition damage if gold is negative
    if (civ.gold < 0) {
      addNotification(state, 'unit', `${civ.name} has negative gold (${civ.gold})! Units taking attrition damage.`, civId);
      const unitsToRemove: string[] = [];
      for (const unitId of civ.units) {
        const unit = state.units[unitId];
        if (!unit) continue;
        unit.hp -= 10;
        events.push(`${civ.name}'s ${unit.type} took 10 attrition damage due to negative gold (${unit.hp}/${unit.maxHp} HP)`);
        if (unit.hp <= 0) {
          // Unit dies from attrition
          state.grid[unit.y][unit.x].unitId = null;
          delete state.units[unitId];
          unitsToRemove.push(unitId);
          events.push(`${civ.name}'s ${unit.type} disbanded due to attrition`);
        }
      }
      civ.units = civ.units.filter(id => !unitsToRemove.includes(id));
    }

    // Process city production (with golden age bonus and government bonuses)
    // Skip production during anarchy
    if (!isInAnarchy) {
      for (const cityId of civ.cities) {
        const city = state.cities[cityId];
        if (!city || !city.currentProduction) continue;

        // Apply golden age bonus to production
        let productionThisTurn = city.productionPerTurn;
        if (isInGoldenAge(state, civId)) {
          productionThisTurn = Math.floor(productionThisTurn * (1 + GOLDEN_AGE_PRODUCTION_BONUS));
        }
        // Apply communism production bonus
        if (gov?.effects?.productionBonus) {
          productionThisTurn += gov.effects.productionBonus;
        }
        city.currentProduction.progress += productionThisTurn;

      if (city.currentProduction.progress >= city.currentProduction.cost) {
        // Production complete
        if (city.currentProduction.type === 'building') {
          const buildingId = city.currentProduction.target;
          city.buildings.push(buildingId);

          // Apply building effects from ruleset
          const building = ruleset.getBuilding(buildingId);
          if (building) {
            const effects = building.effects;
            if (effects.gold) city.goldPerTurn += effects.gold;
            if (effects.food) city.foodPerTurn += effects.food;
            if (effects.production) city.productionPerTurn += effects.production;
            if (effects.defense) city.defense += effects.defense;
            if (effects.science) city.sciencePerTurn += effects.science;
            if (effects.culture) {
              // Culture contributes to score
              civ.score += effects.culture;
            }

            // Check for spaceship part completion
            if (buildingId === 'spaceship_booster') {
              civ.spaceshipParts.booster = true;
              addNotification(state, 'tech', `${civ.name} completed the Spaceship Booster!`, civId, { x: city.x, y: city.y });
            } else if (buildingId === 'spaceship_cockpit') {
              civ.spaceshipParts.cockpit = true;
              addNotification(state, 'tech', `${civ.name} completed the Spaceship Cockpit!`, civId, { x: city.x, y: city.y });
            } else if (buildingId === 'spaceship_engine') {
              civ.spaceshipParts.engine = true;
              addNotification(state, 'tech', `${civ.name} completed the Spaceship Engine!`, civId, { x: city.x, y: city.y });
            }

            // Check for Science Victory (all 3 spaceship parts completed)
            if (civ.spaceshipParts.booster && civ.spaceshipParts.cockpit && civ.spaceshipParts.engine) {
              state.winner = civId;
              state.victoryType = 'science';
              events.push(`${civ.name} wins by Science Victory! The spaceship has launched to Alpha Centauri!`);
              addNotification(state, 'tech', `${civ.name} achieves Science Victory! Humanity reaches Alpha Centauri!`, civId);
            }
          }

          events.push(`${civId}'s ${city.name} completed ${buildingId}`);
          addNotification(state, 'city', `${city.name} completed ${buildingId}!`, civId, { x: city.x, y: city.y });
          addTurnEvent(state, 'building_completed', `${civ.name}'s ${city.name} completed ${buildingId}`, civId);
        } else {
          // Spawn unit
          const unitType = city.currentProduction.target;
          const unitDef = ruleset.getUnit(unitType);
          if (unitDef) {
            // Find adjacent empty tile
            const spawnTile = findSpawnTile(state, city.x, city.y);
            if (spawnTile) {
              const unitId = `u${nextSpawnedUnitId++}`;
              const unit: Unit = {
                id: unitId, type: unitType, ownerId: civId,
                x: spawnTile.x, y: spawnTile.y,
                hp: unitDef.hp, maxHp: unitDef.hp,
                attack: unitDef.attack, defense: unitDef.defense,
                movement: unitDef.movement, movementLeft: unitDef.movement,
              };
              state.units[unitId] = unit;
              state.grid[spawnTile.y][spawnTile.x].unitId = unitId;
              civ.units.push(unitId);
              events.push(`${civId}'s ${city.name} produced a ${unitType}`);
              addNotification(state, 'city', `${city.name} produced a ${unitType}!`, civId, { x: city.x, y: city.y });
              addTurnEvent(state, 'unit_created', `${civ.name}'s ${city.name} produced a ${unitType}`, civId);
            }
          }
        }
        city.currentProduction = undefined;
        }
      }
    } // End of anarchy check for production

    // Recalculate city yields including improvements
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city) continue;

      // Base yields from population
      let baseGold = Math.floor(city.population * 1.5);
      let baseFood = city.population;
      let baseProduction = 1;

      // Add building effects
      for (const bId of city.buildings) {
        const b = ruleset.getBuilding(bId);
        if (b?.effects?.gold) baseGold += b.effects.gold;
        if (b?.effects?.food) baseFood += b.effects.food;
        if (b?.effects?.production) baseProduction += b.effects.production;
      }

      // Add improvement bonuses from tiles within city radius
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 2) continue;
          const nx = city.x + dx;
          const ny = city.y + dy;
          if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
            const tile = state.grid[ny][nx];
            if (tile.ownerId === civId && tile.improvement) {
              const improvement = ruleset.getImprovement(tile.improvement);
              if (improvement) {
                if (improvement.effects.food) baseFood += improvement.effects.food;
                if (improvement.effects.production) baseProduction += improvement.effects.production;
                if (improvement.effects.gold) baseGold += improvement.effects.gold;
              }
            }
          }
        }
      }

      // Add natural wonder bonuses from tiles within city radius
      let baseCulture = city.culturePerTurn;
      let baseScience = city.sciencePerTurn;
      for (let nwdy = -2; nwdy <= 2; nwdy++) {
        for (let nwdx = -2; nwdx <= 2; nwdx++) {
          if (Math.abs(nwdx) + Math.abs(nwdy) > 2) continue;
          const nwx = city.x + nwdx;
          const nwy = city.y + nwdy;
          if (nwx >= 0 && nwx < state.gridSize && nwy >= 0 && nwy < state.gridSize) {
            const tile = state.grid[nwy][nwx];
            if (tile.ownerId === civId && tile.naturalWonderId) {
              const wonder = state.naturalWonders[tile.naturalWonderId];
              if (wonder) {
                if (wonder.bonuses.food) baseFood += wonder.bonuses.food;
                if (wonder.bonuses.gold) baseGold += wonder.bonuses.gold;
                if (wonder.bonuses.production) baseProduction += wonder.bonuses.production;
                if (wonder.bonuses.culture) baseCulture += wonder.bonuses.culture;
                if (wonder.bonuses.science) baseScience += wonder.bonuses.science;

                // First civ to discover (have in territory) gets happiness bonus
                if (!wonder.discoveredBy) {
                  wonder.discoveredBy = civId;
                  civ.happiness += 2;
                  events.push(`${civ.name} discovered ${wonder.name}! (+2 happiness)`);
                  addNotification(state, 'city', `${city.name} discovered ${wonder.name}!`, civId, { x: wonder.x, y: wonder.y });
                }
              }
            }
          }
        }
      }

      city.goldPerTurn = baseGold;
      city.foodPerTurn = baseFood;
      city.productionPerTurn = baseProduction;
      city.culturePerTurn = baseCulture;
      city.sciencePerTurn = baseScience;
    }

    // Population growth (simplified)
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city) continue;

      // Calculate food surplus
      let foodSurplus = city.foodPerTurn - city.population;

      // Check if city has Aqueduct for +50% population growth bonus
      if (foodSurplus > 0) {
        const hasAqueduct = city.buildings.includes('aqueduct');
        if (hasAqueduct) {
          // Apply +50% bonus to food surplus for growth calculation
          foodSurplus = Math.floor(foodSurplus * 1.5);
        }
      }

      // Growth happens every 3 turns if there's positive food surplus
      if (foodSurplus > 0 && state.turn % 3 === 0) {
        city.population++;
      }
    }

    // Process culture and border expansion
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city) continue;

      // Add culture production to stored culture (culture = population * 2)
      const cultureProduction = city.population * 2;
      city.cultureStored += cultureProduction;

      // Calculate culture needed for next expansion: borderRadius^2 * 25
      const cultureNeeded = city.borderRadius * city.borderRadius * 25;

      // Check if we can expand borders (max radius is 3)
      if (city.cultureStored >= cultureNeeded && city.borderRadius < 3) {
        city.borderRadius++;
        city.cultureStored = 0;

        // Claim new tiles within expanded radius
        const radius = city.borderRadius;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = city.x + dx;
            const ny = city.y + dy;
            if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
              if (Math.abs(dx) + Math.abs(dy) <= radius && !state.grid[ny][nx].ownerId) {
                state.grid[ny][nx].ownerId = civId;
              }
            }
          }
        }

        events.push(`${civ.name}'s ${city.name} expanded its borders to radius ${city.borderRadius}`);
        addTurnEvent(state, 'city_growth', `${city.name} expanded its cultural borders`, civId);
      }
    }

    // Process golden age points and effects
    const goldenAgeEvents = processGoldenAge(state, civId);
    events.push(...goldenAgeEvents);

    // Process great people points and spawning
    const greatPeopleEvents = processGreatPeople(state, civId);
    events.push(...greatPeopleEvents);

    // Process tech research
    const techEvents = processResearch(state, civId);
    events.push(...techEvents);

    // Reset unit movement
    for (const unitId of civ.units) {
      const unit = state.units[unitId];
      if (unit) unit.movementLeft = unit.movement;
    }

    // Unit healing logic
    for (const unitId of civ.units) {
      const unit = state.units[unitId];
      if (!unit) continue;
      if (unit.hp >= unit.maxHp) continue; // Already at full health

      // Determine healing amount based on location and activity
      let healAmount = 0;

      // Check if unit acted this turn - units that acted don't heal
      if (!unit.actedThisTurn) {
        const tile = state.grid[unit.y]?.[unit.x];
        if (tile) {
          // Check if in a friendly city
          if (tile.cityId) {
            const city = state.cities[tile.cityId];
            if (city && city.ownerId === civId) {
              healAmount = 20; // In friendly city: heal 20 HP
            }
          } else if (tile.ownerId === civId) {
            // In friendly territory (but not in a city): heal 15 HP
            healAmount = 15;
          } else {
            // Not in friendly territory: heal 10 HP (base healing for inactive units)
            healAmount = 10;
          }
        }
      }

      if (healAmount > 0) {
        const oldHp = unit.hp;
        unit.hp = Math.min(unit.hp + healAmount, unit.maxHp);
        if (unit.hp > oldHp) {
          events.push(`${civ.name}'s ${unit.type} healed ${unit.hp - oldHp} HP (${unit.hp}/${unit.maxHp})`);
        }
      }
    }

    // Calculate score

    // ========================================================================
    // Happiness and War Weariness Processing
    // ========================================================================

    // Check if at war with any civ
    const isAtWar = Object.values(civ.relationships).some(rel => rel === 'war');

    // War weariness: +2 per turn at war, -1 per turn at peace
    if (isAtWar) {
      civ.warWeariness += 2;
    } else {
      civ.warWeariness = Math.max(0, civ.warWeariness - 1);
    }

    // Count luxury resources in controlled territory (gold, horses count as luxury)
    let luxuryCount = 0;
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) {
        const tile = state.grid[y][x];
        if (tile.ownerId === civId && (tile.resource === 'gold' || tile.resource === 'horses')) {
          luxuryCount++;
        }
      }
    }

    // Calculate base happiness: 10 + (luxury resources * 4)
    let baseHappiness = 10 + (luxuryCount * 4);

    // Apply government happiness bonus (e.g., Democracy: +3 happiness) - only if not in anarchy
    if (!isInAnarchy && gov?.effects?.happinessBonus) {
      baseHappiness += gov.effects.happinessBonus;
    }

    // Each city reduces happiness by (population - happiness buildings)
    // Communism's noHappinessPenalty skips population penalty entirely
    const skipPopulationPenalty = !isInAnarchy && gov?.effects?.noHappinessPenalty === true;

    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city) continue;

      // Calculate happiness bonus from buildings
      let cityHappinessBonus = 0;
      for (const buildingId of city.buildings) {
        const building = ruleset.getBuilding(buildingId);
        if (building?.effects?.happiness) {
          cityHappinessBonus += building.effects.happiness;
        }
      }

      // Store local happiness for the city
      city.localHappiness = cityHappinessBonus;

      // City unhappiness = population - building happiness bonus
      // Skip population penalty if government provides noHappinessPenalty (e.g., Communism)
      if (!skipPopulationPenalty) {
        const cityUnhappiness = Math.max(0, city.population - cityHappinessBonus);
        baseHappiness -= cityUnhappiness;
      }
    }

    // Calculate effective war weariness with government reduction (e.g., Democracy: 0.5 multiplier)
    let effectiveWarWeariness = civ.warWeariness;
    if (!isInAnarchy && gov?.effects?.warWearinessReduction) {
      effectiveWarWeariness = Math.floor(civ.warWeariness * gov.effects.warWearinessReduction);
    }

    // Final happiness = base happiness - war weariness
    civ.happiness = baseHappiness - effectiveWarWeariness;

    // Happiness effects on production
    if (civ.happiness < 0) {
      // Apply -25% production penalty to cities
      for (const cityId of civ.cities) {
        const city = state.cities[cityId];
        if (city?.currentProduction) {
          // Reduce production progress by 25% of what was added this turn
          const productionPenalty = Math.floor(city.productionPerTurn * 0.25);
          city.currentProduction.progress = Math.max(0, city.currentProduction.progress - productionPenalty);
        }
      }
    }

    // Check for city revolt risk at happiness < -10
    if (civ.happiness < -10) {
      addNotification(state, 'city', `${civ.name} is experiencing severe unhappiness! Cities may revolt!`, civId);
    }

    civ.score = civ.cities.length * 10 + civ.units.length * 2 + Math.floor(civ.gold / 10) +
      Object.values(state.cities).filter(c => c.ownerId === civId).reduce((s, c) => s + c.population, 0) * 3 +
      civ.researchedTechs.length * 5;

    // Check alive status
    if (civ.cities.length === 0 && civ.units.filter(id => state.units[id]).length === 0) {
      civ.isAlive = false;
      events.push(`${civ.name} has been eliminated!`);
    }
  }

  // Process trade routes: decrement turns and remove expired routes
  const expiredRoutes: string[] = [];
  for (const routeId of Object.keys(state.tradeRoutes)) {
    const route = state.tradeRoutes[routeId];
    route.turnsRemaining--;

    if (route.turnsRemaining <= 0) {
      expiredRoutes.push(routeId);
      const fromCity = state.cities[route.fromCityId];
      const toCity = state.cities[route.toCityId];
      const unit = state.units[route.unitId];
      if (fromCity && toCity && unit) {
        const civ = state.civilizations[unit.ownerId];
        events.push(`${civ?.name || unit.ownerId}'s trade route from ${fromCity.name} to ${toCity.name} has expired`);
        addNotification(state, 'city', `Trade route from ${fromCity.name} to ${toCity.name} has expired. Caravan is now free.`, unit.ownerId, { x: fromCity.x, y: fromCity.y });
      }
    }
  }

  // Remove expired routes
  for (const routeId of expiredRoutes) {
    delete state.tradeRoutes[routeId];
  }

  // Process barbarian camps and units
  const barbarianEvents = processBarbarianTurn(state);
  events.push(...barbarianEvents);

  // Check win conditions (skip if already won via science victory)
  if (!state.winner) {
    const aliveCivs = civIds.filter(id => state.civilizations[id].isAlive);
    if (aliveCivs.length === 1) {
      state.winner = aliveCivs[0];
      state.victoryType = 'conquest';
      events.push(`${state.civilizations[aliveCivs[0]].name} wins by conquest!`);
    } else if (state.turn >= state.maxTurns) {
      // Score victory
      let highScore = 0;
      let winner: CivId | null = null;
      for (const civId of civIds) {
        if (state.civilizations[civId].score > highScore) {
          highScore = state.civilizations[civId].score;
          winner = civId;
        }
      }
      if (winner) {
        state.winner = winner;
        state.victoryType = 'score';
        events.push(`${state.civilizations[winner].name} wins by score (${highScore})!`);
      }
    }
  }

  return events;
}

function findSpawnTile(state: CivGameState, cx: number, cy: number): { x: number; y: number } | null {
  const dirs = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
  ];

  for (const dir of dirs) {
    const nx = cx + dir.dx;
    const ny = cy + dir.dy;
    if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
      const tile = state.grid[ny][nx];
      if (tile.terrain !== 'water' && tile.terrain !== 'mountain' && !tile.unitId) {
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}

// ============================================================================
// Barbarian Processing
// ============================================================================

const BARBARIAN_SPAWN_INTERVAL = 5;
const BARBARIAN_MAX_UNITS_PER_CAMP = 3;
const BARBARIAN_GOLD_REWARD = 25;
const BARBARIAN_CIV_ID = 'barbarians';

let nextBarbarianUnitId = 1000;

function processBarbarianTurn(state: CivGameState): string[] {
  const events: string[] = [];

  for (const campId of Object.keys(state.barbarianCamps)) {
    const camp = state.barbarianCamps[campId];
    let unitsFromCamp = 0;
    for (const unitId of state.barbarianUnits) {
      const unit = state.units[unitId];
      if (unit) {
        const dist = Math.abs(unit.x - camp.x) + Math.abs(unit.y - camp.y);
        if (dist <= 10) unitsFromCamp++;
      }
    }

    if (state.turn % BARBARIAN_SPAWN_INTERVAL === 0 && unitsFromCamp < BARBARIAN_MAX_UNITS_PER_CAMP) {
      const spawnTile = findSpawnTile(state, camp.x, camp.y);
      if (spawnTile) {
        const unitId = `barb_u${nextBarbarianUnitId++}`;
        const unit: Unit = {
          id: unitId, type: 'warrior', ownerId: BARBARIAN_CIV_ID,
          x: spawnTile.x, y: spawnTile.y, hp: 80, maxHp: 80,
          attack: 8, defense: 5, movement: 2, movementLeft: 2,
        };
        state.units[unitId] = unit;
        state.grid[spawnTile.y][spawnTile.x].unitId = unitId;
        state.barbarianUnits.push(unitId);
        events.push(`A barbarian warrior emerges from camp at (${camp.x}, ${camp.y})`);
        addNotification(state, 'combat', `Barbarian warrior spawned near camp!`, undefined, { x: camp.x, y: camp.y });
      }
    }

    const campTile = state.grid[camp.y]?.[camp.x];
    if (campTile && campTile.unitId) {
      const unitOnCamp = state.units[campTile.unitId];
      if (unitOnCamp && unitOnCamp.ownerId !== BARBARIAN_CIV_ID) {
        const civ = state.civilizations[unitOnCamp.ownerId];
        if (civ) {
          civ.gold += BARBARIAN_GOLD_REWARD;
          events.push(`${civ.name} destroyed barbarian camp and received ${BARBARIAN_GOLD_REWARD} gold!`);
          addNotification(state, 'combat', `${civ.name} destroyed barbarian camp!`, unitOnCamp.ownerId, { x: camp.x, y: camp.y });
        }
        delete state.barbarianCamps[campId];
      }
    }
  }

  const unitsToRemove: string[] = [];
  const adjacentOffsets = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

  for (const unitId of state.barbarianUnits) {
    const unit = state.units[unitId];
    if (!unit) { unitsToRemove.push(unitId); continue; }

    unit.movementLeft = unit.movement;
    let nearestCity: { x: number; y: number; dist: number } | null = null;
    for (const city of Object.values(state.cities)) {
      const dist = Math.abs(unit.x - city.x) + Math.abs(unit.y - city.y);
      if (!nearestCity || dist < nearestCity.dist) nearestCity = { x: city.x, y: city.y, dist };
    }

    let attacked = false;
    for (const offset of adjacentOffsets) {
      const nx = unit.x + offset.dx;
      const ny = unit.y + offset.dy;
      if (nx < 0 || nx >= state.gridSize || ny < 0 || ny >= state.gridSize) continue;
      const tile = state.grid[ny][nx];
      if (tile.unitId) {
        const target = state.units[tile.unitId];
        if (target && target.ownerId !== BARBARIAN_CIV_ID) {
          const result = resolveCombat(state, unitId, tile.unitId, state.turn);
          if (result) {
            events.push(`Barbarian attacked ${result.defenderCiv}'s unit: ${result.defenderDamage} damage`);
            if (result.defenderDestroyed) {
              state.grid[target.y][target.x].unitId = null;
              const defCiv = state.civilizations[target.ownerId];
              if (defCiv) defCiv.units = defCiv.units.filter(id => id !== target.id);
              delete state.units[target.id];
              addNotification(state, 'combat', `Barbarians destroyed a unit!`, result.defenderCiv, { x: target.x, y: target.y });
            }
            if (result.attackerDestroyed) {
              state.grid[unit.y][unit.x].unitId = null;
              delete state.units[unitId];
              unitsToRemove.push(unitId);
            }
            state.combatLog.push(result);
            attacked = true;
            break;
          }
        }
      }
    }

    if (!attacked && state.units[unitId] && nearestCity && unit.movementLeft > 0) {
      let bestMove: { x: number; y: number; dist: number } | null = null;
      for (const offset of adjacentOffsets) {
        const nx = unit.x + offset.dx;
        const ny = unit.y + offset.dy;
        if (nx < 0 || nx >= state.gridSize || ny < 0 || ny >= state.gridSize) continue;
        const tile = state.grid[ny][nx];
        if (tile.terrain === 'water' || tile.terrain === 'mountain' || tile.unitId) continue;
        const distToCity = Math.abs(nx - nearestCity.x) + Math.abs(ny - nearestCity.y);
        if (!bestMove || distToCity < bestMove.dist) bestMove = { x: nx, y: ny, dist: distToCity };
      }
      if (bestMove) {
        state.grid[unit.y][unit.x].unitId = null;
        unit.x = bestMove.x;
        unit.y = bestMove.y;
        state.grid[unit.y][unit.x].unitId = unit.id;
        unit.movementLeft = 0;
      }
    }
  }

  state.barbarianUnits = state.barbarianUnits.filter(id => !unitsToRemove.includes(id));
  return events;
}

// ============================================================================
// Great People processing
// ============================================================================

const GREAT_PERSON_THRESHOLD_MULTIPLIER = 1.5; // 50% increase after each great person

/**
 * Map great person type to unit type
 */
function getGreatPersonUnitType(gpType: GreatPersonType): string {
  return `great_${gpType}`;
}

let nextGreatPersonUnitId = 500;

/**
 * Spawn a great person unit in the civ's capital
 */
function spawnGreatPerson(state: CivGameState, civId: CivId, gpType: GreatPersonType): string[] {
  const events: string[] = [];
  const civ = state.civilizations[civId];
  if (!civ || !civ.isAlive || civ.cities.length === 0) return events;

  // Find the capital (first city)
  const capitalId = civ.cities[0];
  const capital = state.cities[capitalId];
  if (!capital) return events;

  // Get the unit definition
  const unitTypeName = getGreatPersonUnitType(gpType);
  const unitDef = ruleset.getUnit(unitTypeName);
  if (!unitDef) return events;

  // Find a spawn tile near the capital
  const spawnTile = findSpawnTileForGreatPerson(state, capital.x, capital.y);
  if (!spawnTile) return events;

  // Create the great person unit
  const unitId = `gp${nextGreatPersonUnitId++}`;
  const unit: Unit = {
    id: unitId,
    type: unitTypeName,
    ownerId: civId,
    x: spawnTile.x,
    y: spawnTile.y,
    hp: unitDef.hp,
    maxHp: unitDef.hp,
    attack: unitDef.attack,
    defense: unitDef.defense,
    movement: unitDef.movement,
    movementLeft: unitDef.movement,
    isGreatPerson: true,
  };

  state.units[unitId] = unit;
  state.grid[spawnTile.y][spawnTile.x].unitId = unitId;
  civ.units.push(unitId);

  // Get the great person definition for the name
  const gpDef = ruleset.getGreatPersonByType(gpType);
  const gpName = gpDef?.name ?? `Great ${gpType.charAt(0).toUpperCase() + gpType.slice(1)}`;

  events.push(`${civ.name} has earned a ${gpName}!`);
  addNotification(state, 'unit', `${civ.name} has earned a ${gpName} in ${capital.name}!`, civId, { x: capital.x, y: capital.y });
  addTurnEvent(state, 'unit_created', `${civ.name} earned a ${gpName}`, civId);

  return events;
}

/**
 * Find a spawn tile for a great person near a city
 */
function findSpawnTileForGreatPerson(state: CivGameState, cx: number, cy: number): { x: number; y: number } | null {
  const dirs = [
    { dx: 0, dy: 0 }, // Try city tile first
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
  ];

  for (const dir of dirs) {
    const nx = cx + dir.dx;
    const ny = cy + dir.dy;
    if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
      const tile = state.grid[ny][nx];
      if (tile.terrain !== 'water' && tile.terrain !== 'mountain' && !tile.unitId) {
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}

/**
 * Process great people points accumulation for a civilization
 */
export function processGreatPeople(state: CivGameState, civId: CivId): string[] {
  const events: string[] = [];
  const civ = state.civilizations[civId];
  if (!civ || !civ.isAlive) return events;

  // Initialize greatPeopleProgress and thresholds if they don't exist
  if (!civ.greatPeopleProgress) {
    civ.greatPeopleProgress = {
      scientist: 0,
      artist: 0,
      general: 0,
      merchant: 0,
      engineer: 0,
    };
  }
  if (!civ.greatPeopleThresholds) {
    civ.greatPeopleThresholds = {
      scientist: 100,
      artist: 100,
      general: 100,
      merchant: 100,
      engineer: 100,
    };
  }

  // Calculate points from each city
  for (const cityId of civ.cities) {
    const city = state.cities[cityId];
    if (!city) continue;

    // Scientist progress: cities with library/university add science / 10
    const hasLibrary = city.buildings.includes('library');
    const hasUniversity = city.buildings.includes('university');
    if (hasLibrary || hasUniversity) {
      const scienceBonus = Math.floor(city.sciencePerTurn / 10);
      civ.greatPeopleProgress.scientist += scienceBonus;
    }

    // Merchant progress: cities with market/bank add gold / 10
    const hasMarket = city.buildings.includes('market');
    const hasBank = city.buildings.includes('bank');
    if (hasMarket || hasBank) {
      const goldBonus = Math.floor(city.goldPerTurn / 10);
      civ.greatPeopleProgress.merchant += goldBonus;
    }

    // Artist progress: culture / 10
    const cultureBonus = Math.floor(city.culturePerTurn / 10);
    civ.greatPeopleProgress.artist += cultureBonus;

    // Engineer progress: production buildings add to engineer progress
    const hasWorkshop = city.buildings.includes('workshop');
    const hasForge = city.buildings.includes('forge');
    const hasWatermill = city.buildings.includes('watermill');
    if (hasWorkshop || hasForge || hasWatermill) {
      const productionBonus = Math.floor(city.productionPerTurn / 10);
      civ.greatPeopleProgress.engineer += productionBonus;
    }
  }

  // General progress is added during combat (handled separately via addGreatGeneralProgress)
  // We just check thresholds here

  // Check each great person type for threshold
  const greatPersonTypes: GreatPersonType[] = ['scientist', 'artist', 'general', 'merchant', 'engineer'];

  for (const gpType of greatPersonTypes) {
    const progress = civ.greatPeopleProgress[gpType];
    const threshold = civ.greatPeopleThresholds[gpType];

    if (progress >= threshold) {
      // Spawn the great person
      const spawnEvents = spawnGreatPerson(state, civId, gpType);
      events.push(...spawnEvents);

      // Reset progress and increase threshold by 50%
      civ.greatPeopleProgress[gpType] = 0;
      civ.greatPeopleThresholds[gpType] = Math.floor(threshold * GREAT_PERSON_THRESHOLD_MULTIPLIER);
    }
  }

  return events;
}

/**
 * Add great general progress from combat damage
 * Call this from combat resolution
 */
export function addGreatGeneralProgress(state: CivGameState, civId: CivId, damage: number): void {
  const civ = state.civilizations[civId];
  if (!civ || !civ.isAlive) return;

  // Initialize if needed
  if (!civ.greatPeopleProgress) {
    civ.greatPeopleProgress = {
      scientist: 0,
      artist: 0,
      general: 0,
      merchant: 0,
      engineer: 0,
    };
  }

  // Combat adds to general progress (damage dealt / 5)
  const generalProgress = Math.floor(damage / 5);
  civ.greatPeopleProgress.general += generalProgress;
}
