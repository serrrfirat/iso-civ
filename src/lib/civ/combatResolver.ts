import { CivGameState, CombatEvent } from '@/games/civ/types';
import { ruleset } from './ruleset';
import { addGreatGeneralProgress } from './civSimulation';

// Simple deterministic hash for combat randomness
function combatHash(seed: number, a: string, b: string, turn: number): number {
  let h = seed ^ turn;
  for (const c of a + b) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return ((h >>> 0) / 4294967296); // 0..1
}

// Count friendly units (belonging to attacker) adjacent to the defender
// Adjacent means Manhattan distance 1
function countFlankingUnits(
  state: CivGameState,
  attackerId: string,
  defenderId: string
): number {
  const attacker = state.units[attackerId];
  const defender = state.units[defenderId];
  if (!attacker || !defender) return 0;

  const defX = defender.x;
  const defY = defender.y;
  const attackerOwnerId = attacker.ownerId;

  let count = 0;
  // Check all 4 adjacent tiles (Manhattan distance 1)
  const adjacentOffsets = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const offset of adjacentOffsets) {
    const nx = defX + offset.dx;
    const ny = defY + offset.dy;

    // Check bounds
    if (nx < 0 || nx >= state.gridSize || ny < 0 || ny >= state.gridSize) continue;

    const tile = state.grid[ny]?.[nx];
    if (!tile || !tile.unitId) continue;

    const adjacentUnit = state.units[tile.unitId];
    // Count if the adjacent unit belongs to the attacker's civilization
    // and is not the attacker itself
    if (adjacentUnit && adjacentUnit.ownerId === attackerOwnerId && adjacentUnit.id !== attackerId) {
      count++;
    }
  }

  return count;
}

// Calculate flanking bonus: +10% per adjacent friendly unit, max +30%
function getFlankingBonus(flankingCount: number): number {
  const bonusPerUnit = 0.10; // 10% per flanking unit
  const maxBonus = 0.30; // Max 30%
  return Math.min(flankingCount * bonusPerUnit, maxBonus);
}

// Calculate bonusVs bonus: +50% attack if attacker has bonusVs matching defender's class
// Example: Pikeman (bonusVs: "mounted") gets +50% when attacking Horseman/Knight/Chariot (class: mounted)
function getBonusVsMultiplier(attackerType: string, defenderType: string): number {
  const attackerUnit = ruleset.getUnit(attackerType);
  const defenderUnit = ruleset.getUnit(defenderType);

  if (!attackerUnit || !defenderUnit) return 1.0;

  // Check if attacker has bonusVs and it matches defender's class
  if (attackerUnit.bonusVs && attackerUnit.bonusVs === defenderUnit.class) {
    return 1.5; // +50% attack bonus
  }

  return 1.0;
}

export function resolveCombat(
  state: CivGameState,
  attackerId: string,
  defenderId: string,
  seed: number,
): CombatEvent | null {
  const attacker = state.units[attackerId];
  const defender = state.units[defenderId];

  if (!attacker || !defender) return null;
  if (attacker.ownerId === defender.ownerId) return null;

  const defenderTerrain = state.grid[defender.y]?.[defender.x]?.terrain || 'plains';
  const terrainBonus = ruleset.getDefenseBonus(defenderTerrain);

  // Calculate fortification bonus (+25% defense for fortified units)
  const fortificationBonus = defender.fortified ? defender.defense * 0.25 : 0;

  // Calculate flanking bonus (+10% attack per adjacent friendly unit, max +30%)
  const flankingCount = countFlankingUnits(state, attackerId, defenderId);
  const flankingBonus = getFlankingBonus(flankingCount);

  // Calculate bonusVs multiplier (+50% if attacker's bonusVs matches defender's class)
  const bonusVsMultiplier = getBonusVsMultiplier(attacker.type, defender.type);

  // Calculate damage
  const roll = combatHash(seed, attackerId, defenderId, state.turn);
  const attackModifier = 0.8 + roll * 0.4; // 0.8 to 1.2
  const defenseModifier = 0.8 + (1 - roll) * 0.4;

  // Apply flanking bonus and bonusVs to attacker's attack value
  const effectiveAttack = attacker.attack * (1 + flankingBonus) * bonusVsMultiplier;
  const attackDamage = Math.max(1, Math.round(effectiveAttack * attackModifier - (defender.defense + terrainBonus + fortificationBonus) * 0.3));
  const counterDamage = Math.max(1, Math.round(defender.attack * defenseModifier * 0.5 - attacker.defense * 0.3));

  // Apply damage
  defender.hp -= attackDamage;
  attacker.hp -= counterDamage;

  // Add great general progress based on damage dealt (damage / 5)
  addGreatGeneralProgress(state, attacker.ownerId, attackDamage);
  addGreatGeneralProgress(state, defender.ownerId, counterDamage);

  const event: CombatEvent = {
    turn: state.turn,
    attackerId, defenderId,
    attackerCiv: attacker.ownerId,
    defenderCiv: defender.ownerId,
    location: { x: defender.x, y: defender.y },
    attackerDamage: counterDamage,
    defenderDamage: attackDamage,
    attackerDestroyed: attacker.hp <= 0,
    defenderDestroyed: defender.hp <= 0,
  };

  return event;
}

export function resolveRangedCombat(
  state: CivGameState,
  attackerId: string,
  defenderId: string,
  seed: number,
): CombatEvent | null {
  const attacker = state.units[attackerId];
  const defender = state.units[defenderId];

  if (!attacker || !defender) return null;
  if (attacker.ownerId === defender.ownerId) return null;

  const defenderTerrain = state.grid[defender.y]?.[defender.x]?.terrain || 'plains';
  const terrainBonus = ruleset.getDefenseBonus(defenderTerrain);

  // Calculate fortification bonus (+25% defense for fortified units)
  const fortificationBonus = defender.fortified ? defender.defense * 0.25 : 0;

  // Calculate bonusVs multiplier (+50% if attacker's bonusVs matches defender's class)
  const bonusVsMultiplier = getBonusVsMultiplier(attacker.type, defender.type);

  // Calculate damage - ranged attacks do not receive counter damage
  const roll = combatHash(seed, attackerId, defenderId, state.turn);
  const attackModifier = 0.8 + roll * 0.4; // 0.8 to 1.2

  // Apply bonusVs to attacker's attack value
  const effectiveAttack = attacker.attack * bonusVsMultiplier;
  const attackDamage = Math.max(1, Math.round(effectiveAttack * attackModifier - (defender.defense + terrainBonus + fortificationBonus) * 0.3));

  // Apply damage only to defender (no counter-attack for ranged combat)
  defender.hp -= attackDamage;

  // Add great general progress based on damage dealt (damage / 5)
  addGreatGeneralProgress(state, attacker.ownerId, attackDamage);

  const event: CombatEvent = {
    turn: state.turn,
    attackerId, defenderId,
    attackerCiv: attacker.ownerId,
    defenderCiv: defender.ownerId,
    location: { x: defender.x, y: defender.y },
    attackerDamage: 0, // No counter damage in ranged combat
    defenderDamage: attackDamage,
    attackerDestroyed: false, // Attacker cannot be destroyed in ranged combat
    defenderDestroyed: defender.hp <= 0,
  };

  return event;
}

export function resolveCityAttack(
  state: CivGameState,
  attackerId: string,
  cityId: string,
  seed: number,
): { damage: number; cityCaptured: boolean } | null {
  const attacker = state.units[attackerId];
  const city = state.cities[cityId];

  if (!attacker || !city) return null;
  if (attacker.ownerId === city.ownerId) return null;

  const roll = combatHash(seed, attackerId, cityId, state.turn);
  const damage = Math.max(1, Math.round(attacker.attack * (0.8 + roll * 0.4) - city.defense * 0.5));

  city.defense -= damage;
  attacker.hp -= Math.max(1, Math.round(city.defense * 0.2));

  const captured = city.defense <= 0;

  return { damage, cityCaptured: captured };
}
