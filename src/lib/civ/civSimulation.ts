import { CivGameState, CivId, AgentAction, Unit, City } from '@/games/civ/types';
import { findPath } from './pathfinding';
import { resolveCombat, resolveCityAttack } from './combatResolver';
import { UNIT_STATS } from './mapGenerator';

// ============================================================================
// Building effects
// ============================================================================

export const BUILDING_COSTS: Record<string, { production: number }> = {
  granary:   { production: 40 },
  barracks:  { production: 50 },
  walls:     { production: 60 },
  market:    { production: 50 },
  library:   { production: 60 },
};

export const BUILDING_EFFECTS: Record<string, { goldPerTurn?: number; foodPerTurn?: number; productionPerTurn?: number; defense?: number }> = {
  granary:   { foodPerTurn: 2 },
  barracks:  { productionPerTurn: 1 },
  walls:     { defense: 10 },
  market:    { goldPerTurn: 3 },
  library:   { goldPerTurn: 1, productionPerTurn: 1 },
};

const UNIT_COSTS: Record<string, { production: number }> = {
  warrior: { production: 30 },
  archer:  { production: 35 },
  scout:   { production: 20 },
  settler: { production: 60 },
};

// ============================================================================
// Action validation & execution
// ============================================================================

export function validateAction(state: CivGameState, action: AgentAction, civId: CivId): boolean {
  switch (action.type) {
    case 'move_unit': {
      const unit = state.units[action.unitId];
      if (!unit || unit.ownerId !== civId) return false;
      if (unit.movementLeft <= 0) return false;
      const path = findPath(state, unit.x, unit.y, action.targetX, action.targetY, unit.movementLeft);
      return path !== null;
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
        if (!BUILDING_COSTS[action.target]) return false;
        if (city.buildings.includes(action.target as any)) return false;
      } else {
        if (!UNIT_COSTS[action.target]) return false;
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
      const path = findPath(state, unit.x, unit.y, action.targetX, action.targetY, unit.movementLeft);
      if (!path || path.length < 2) break;

      // Remove from old tile
      state.grid[unit.y][unit.x].unitId = null;

      // Move along path
      const dest = path[path.length - 1];
      let moveCost = 0;
      for (let i = 1; i < path.length; i++) {
        const terrain = state.grid[path[i].y][path[i].x].terrain;
        moveCost += terrain === 'forest' || terrain === 'hills' ? 2 : 1;
      }

      unit.x = dest.x;
      unit.y = dest.y;
      unit.movementLeft = Math.max(0, unit.movementLeft - moveCost);

      // Place on new tile
      state.grid[unit.y][unit.x].unitId = unit.id;

      // Reveal fog of war
      const range = unit.type === 'scout' ? 4 : 2;
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

      events.push(`${civId} moved ${unit.type} to (${dest.x}, ${dest.y})`);
      break;
    }

    case 'attack': {
      const result = resolveCombat(state, action.unitId, action.targetId, seed);
      if (!result) break;

      events.push(`${result.attackerCiv} attacked ${result.defenderCiv}: ${result.defenderDamage} damage dealt, ${result.attackerDamage} received`);

      if (result.defenderDestroyed) {
        const defender = state.units[action.targetId];
        if (defender) {
          state.grid[defender.y][defender.x].unitId = null;
          const defCiv = state.civilizations[defender.ownerId];
          defCiv.units = defCiv.units.filter(id => id !== action.targetId);
          delete state.units[action.targetId];
          events.push(`${result.defenderCiv}'s ${defender.type} was destroyed`);
        }
      }

      if (result.attackerDestroyed) {
        const attacker = state.units[action.unitId];
        if (attacker) {
          state.grid[attacker.y][attacker.x].unitId = null;
          const atkCiv = state.civilizations[attacker.ownerId];
          atkCiv.units = atkCiv.units.filter(id => id !== action.unitId);
          delete state.units[action.unitId];
          events.push(`${result.attackerCiv}'s ${attacker.type} was destroyed`);
        }
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
        buildings: [], defense: 5,
      };
      state.cities[cityId] = city;
      state.grid[settler.y][settler.x].cityId = cityId;
      state.grid[settler.y][settler.x].ownerId = civId;

      // Claim territory
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = settler.x + dx;
          const ny = settler.y + dy;
          if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
            if (Math.abs(dx) + Math.abs(dy) <= 2 && !state.grid[ny][nx].ownerId) {
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
      break;
    }

    case 'build': {
      const city = state.cities[action.cityId];
      if (!city) break;

      const cost = action.targetType === 'building'
        ? BUILDING_COSTS[action.target]?.production || 50
        : UNIT_COSTS[action.target]?.production || 30;

      city.currentProduction = {
        type: action.targetType,
        target: action.target,
        progress: 0,
        cost,
      };

      events.push(`${civId}'s ${city.name} started building ${action.target}`);
      break;
    }
  }

  return events;
}

// ============================================================================
// Turn resolution: economy, production, win conditions
// ============================================================================

export function processEndOfTurn(state: CivGameState): string[] {
  const events: string[] = [];
  const civIds: CivId[] = ['rome', 'egypt', 'mongolia'];

  for (const civId of civIds) {
    const civ = state.civilizations[civId];
    if (!civ.isAlive) continue;

    // Collect gold income
    let totalGold = 0;
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city) continue;
      totalGold += city.goldPerTurn;
    }
    civ.gold += totalGold;

    // Process city production
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city || !city.currentProduction) continue;

      city.currentProduction.progress += city.productionPerTurn;

      if (city.currentProduction.progress >= city.currentProduction.cost) {
        // Production complete
        if (city.currentProduction.type === 'building') {
          const building = city.currentProduction.target;
          city.buildings.push(building as any);

          // Apply building effects
          const effects = BUILDING_EFFECTS[building];
          if (effects) {
            if (effects.goldPerTurn) city.goldPerTurn += effects.goldPerTurn;
            if (effects.foodPerTurn) city.foodPerTurn += effects.foodPerTurn;
            if (effects.productionPerTurn) city.productionPerTurn += effects.productionPerTurn;
            if (effects.defense) city.defense += effects.defense;
          }

          events.push(`${civId}'s ${city.name} completed ${building}`);
        } else {
          // Spawn unit
          const unitType = city.currentProduction.target;
          const stats = UNIT_STATS[unitType];
          if (stats) {
            // Find adjacent empty tile
            const spawnTile = findSpawnTile(state, city.x, city.y);
            if (spawnTile) {
              const unitId = `u${nextSpawnedUnitId++}`;
              const unit: Unit = {
                id: unitId, type: unitType as any, ownerId: civId,
                x: spawnTile.x, y: spawnTile.y,
                hp: stats.maxHp, maxHp: stats.maxHp,
                attack: stats.attack, defense: stats.defense,
                movement: stats.movement, movementLeft: stats.movement,
              };
              state.units[unitId] = unit;
              state.grid[spawnTile.y][spawnTile.x].unitId = unitId;
              civ.units.push(unitId);
              events.push(`${civId}'s ${city.name} produced a ${unitType}`);
            }
          }
        }
        city.currentProduction = undefined;
      }
    }

    // Population growth (simplified)
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (!city) continue;
      if (city.foodPerTurn > city.population && state.turn % 3 === 0) {
        city.population++;
        city.goldPerTurn = Math.floor(city.population * 1.5) + city.buildings.filter(b => b === 'market').length * 3;
      }
    }

    // Reset unit movement
    for (const unitId of civ.units) {
      const unit = state.units[unitId];
      if (unit) unit.movementLeft = unit.movement;
    }

    // Calculate score
    civ.score = civ.cities.length * 10 + civ.units.length * 2 + Math.floor(civ.gold / 10) +
      Object.values(state.cities).filter(c => c.ownerId === civId).reduce((s, c) => s + c.population, 0) * 3;

    // Check alive status
    if (civ.cities.length === 0 && civ.units.filter(id => state.units[id]).length === 0) {
      civ.isAlive = false;
      events.push(`${civ.name} has been eliminated!`);
    }
  }

  // Check win conditions
  const aliveCivs = civIds.filter(id => state.civilizations[id].isAlive);
  if (aliveCivs.length === 1) {
    state.winner = aliveCivs[0];
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
      events.push(`${state.civilizations[winner].name} wins by score (${highScore})!`);
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
