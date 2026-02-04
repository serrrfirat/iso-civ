import { Unit, CivGameState, CombatEvent, TerrainType } from '@/games/civ/types';

// Terrain defense bonuses
const TERRAIN_DEFENSE_BONUS: Record<TerrainType, number> = {
  plains: 0,
  desert: 0,
  forest: 2,
  hills: 3,
  mountain: 5,
  water: 0,
};

// Simple deterministic hash for combat randomness
function combatHash(seed: number, a: string, b: string, turn: number): number {
  let h = seed ^ turn;
  for (const c of a + b) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return ((h >>> 0) / 4294967296); // 0..1
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
  const terrainBonus = TERRAIN_DEFENSE_BONUS[defenderTerrain];

  // Calculate damage
  const roll = combatHash(seed, attackerId, defenderId, state.turn);
  const attackModifier = 0.8 + roll * 0.4; // 0.8 to 1.2
  const defenseModifier = 0.8 + (1 - roll) * 0.4;

  const attackDamage = Math.max(1, Math.round(attacker.attack * attackModifier - (defender.defense + terrainBonus) * 0.3));
  const counterDamage = Math.max(1, Math.round(defender.attack * defenseModifier * 0.5 - attacker.defense * 0.3));

  // Apply damage
  defender.hp -= attackDamage;
  attacker.hp -= counterDamage;

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
