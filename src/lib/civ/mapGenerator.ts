import { CivTile, TerrainType, ResourceType, CivId, CivGameState, Civilization, Unit, City, NaturalWonder, BarbarianCamp } from '@/games/civ/types';
import { ruleset } from './ruleset';

// ============================================================================
// Map Size Configuration
// ============================================================================

export const MAP_SIZES = {
  small: 20,
  medium: 30,
  large: 40,
  huge: 50,
} as const;

export type MapSizeKey = keyof typeof MAP_SIZES;

// Base positions are defined for a 30x30 map, we scale them proportionally
const BASE_MAP_SIZE = 30;

// Base start positions (for 30x30 map) - matches civilizations.json defaults
const BASE_START_POSITIONS: Record<string, { x: number; y: number }> = {
  rome: { x: 5, y: 5 },
  egypt: { x: 24, y: 5 },
  mongolia: { x: 14, y: 24 },
};

/**
 * Scale start positions proportionally to the new map size
 */
function getScaledStartPositions(mapSize: number): Record<string, { x: number; y: number }> {
  const scale = mapSize / BASE_MAP_SIZE;
  const scaledPositions: Record<string, { x: number; y: number }> = {};

  for (const [civId, pos] of Object.entries(BASE_START_POSITIONS)) {
    scaledPositions[civId] = {
      x: Math.round(pos.x * scale),
      y: Math.round(pos.y * scale),
    };
  }

  return scaledPositions;
}

// ============================================================================
// Simplex-style noise for terrain generation
// ============================================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function noise2D(seed: number): (x: number, y: number) => number {
  const perm = new Uint8Array(512);
  const rng = seededRandom(seed);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  const grad = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  return (x: number, y: number): number => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const aa = perm[perm[X] + Y] % 8;
    const ab = perm[perm[X] + Y + 1] % 8;
    const ba = perm[perm[X + 1] + Y] % 8;
    const bb = perm[perm[X + 1] + Y + 1] % 8;

    const dot = (g: number[], fx: number, fy: number) => g[0] * fx + g[1] * fy;

    const x1 = dot(grad[aa], xf, yf) * (1 - u) + dot(grad[ba], xf - 1, yf) * u;
    const x2 = dot(grad[ab], xf, yf - 1) * (1 - u) + dot(grad[bb], xf - 1, yf - 1) * u;

    return x1 * (1 - v) + x2 * v;
  };
}

function fbm(noiseFn: (x: number, y: number) => number, x: number, y: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noiseFn(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

// ============================================================================
// Terrain classification
// ============================================================================

function classifyTerrain(elevation: number, moisture: number): TerrainType {
  if (elevation < -0.15) return 'water';
  if (elevation > 0.45) return 'mountain';
  if (elevation > 0.3) return 'hills';
  if (moisture > 0.2) return 'forest';
  if (moisture < -0.2) return 'desert';
  return 'plains';
}

function placeResource(terrain: TerrainType, rng: () => number): ResourceType | undefined {
  const roll = rng();
  if (roll > 0.85) {
    switch (terrain) {
      case 'plains': return rng() > 0.5 ? 'food' : 'horses';
      case 'hills': return rng() > 0.7 ? 'iron' : 'production';
      case 'desert': return 'gold';
      case 'forest': return 'food';
      default: return undefined;
    }
  }
  return undefined;
}

// ============================================================================
// Start position balancing
// ============================================================================

function ensureStartViable(grid: CivTile[][], pos: { x: number; y: number }, size: number): void {
  // Clear a 3x3 area around start position to plains
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        if (grid[ny][nx].terrain === 'water' || grid[ny][nx].terrain === 'mountain') {
          grid[ny][nx].terrain = 'plains';
        }
      }
    }
  }
  // Ensure food resource nearby
  const foodSpots = [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x - 1, y: pos.y },
  ];
  let hasFood = false;
  for (const spot of foodSpots) {
    if (spot.x >= 0 && spot.x < size && spot.y >= 0 && spot.y < size) {
      if (grid[spot.y][spot.x].resource === 'food') hasFood = true;
    }
  }
  if (!hasFood && foodSpots[0].x < size && foodSpots[0].y < size) {
    grid[foodSpots[0].y][foodSpots[0].x].resource = 'food';
  }
}

// ============================================================================
// Natural Wonder Placement
// ============================================================================

/**
 * Place natural wonders on the map, avoiding start positions
 * Returns a record of placed natural wonders
 */
function placeNaturalWonders(
  grid: CivTile[][],
  gridSize: number,
  startPositions: Record<string, { x: number; y: number }>,
  rng: () => number,
  count: number = 3
): Record<string, NaturalWonder> {
  const naturalWonders: Record<string, NaturalWonder> = {};
  const wonderIds = ruleset.getNaturalWonderIds();

  // Shuffle wonder IDs
  const shuffledWonders = [...wonderIds].sort(() => rng() - 0.5);

  // Get start positions to avoid (within radius 5)
  const forbiddenTiles = new Set<string>();
  for (const pos of Object.values(startPositions)) {
    for (let fdy = -5; fdy <= 5; fdy++) {
      for (let fdx = -5; fdx <= 5; fdx++) {
        forbiddenTiles.add(`${pos.x + fdx},${pos.y + fdy}`);
      }
    }
  }

  // Find candidate tiles for each wonder
  let placedCount = 0;
  for (const wonderId of shuffledWonders) {
    if (placedCount >= count) break;

    const wonderDef = ruleset.getNaturalWonder(wonderId);
    if (!wonderDef) continue;

    // Find tiles matching preferred terrain
    const candidateTiles: { x: number; y: number; score: number }[] = [];

    for (let cy = 3; cy < gridSize - 3; cy++) {
      for (let cx = 3; cx < gridSize - 3; cx++) {
        const key = `${cx},${cy}`;
        if (forbiddenTiles.has(key)) continue;

        const tile = grid[cy][cx];
        // Skip tiles with cities or existing natural wonders
        if (tile.cityId || tile.naturalWonderId) continue;

        // Check if terrain matches preferred terrain
        const terrainMatch = wonderDef.preferredTerrain.includes(tile.terrain);
        if (!terrainMatch) continue;

        // Calculate score based on how interesting the location is
        let score = rng() * 10; // Random base score

        // Bonus for being on preferred terrain
        score += 20;

        // Bonus for being near water (scenic)
        for (let ndy = -1; ndy <= 1; ndy++) {
          for (let ndx = -1; ndx <= 1; ndx++) {
            const nx = cx + ndx;
            const ny = cy + ndy;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
              if (grid[ny][nx].terrain === 'water') score += 5;
            }
          }
        }

        // Penalty for being too close to other natural wonders
        for (const existing of Object.values(naturalWonders)) {
          const dist = Math.abs(cx - existing.x) + Math.abs(cy - existing.y);
          if (dist < 8) score -= (8 - dist) * 5;
        }

        candidateTiles.push({ x: cx, y: cy, score });
      }
    }

    // Sort by score and pick the best one
    candidateTiles.sort((a, b) => b.score - a.score);

    if (candidateTiles.length > 0) {
      const chosen = candidateTiles[0];

      // Create the natural wonder
      const wonder: NaturalWonder = {
        id: wonderId,
        name: wonderDef.name,
        x: chosen.x,
        y: chosen.y,
        bonuses: { ...wonderDef.bonuses },
      };

      naturalWonders[wonderId] = wonder;
      grid[chosen.y][chosen.x].naturalWonderId = wonderId;

      // Mark this tile and surrounding tiles as forbidden for other wonders
      for (let bdy = -3; bdy <= 3; bdy++) {
        for (let bdx = -3; bdx <= 3; bdx++) {
          forbiddenTiles.add(`${chosen.x + bdx},${chosen.y + bdy}`);
        }
      }

      placedCount++;
    }
  }

  return naturalWonders;
}

// ============================================================================
// Game state generation
// ============================================================================

export function generateMap(seed: number, gridSize: number = 30, scaledStartPositions?: Record<string, { x: number; y: number }>): CivTile[][] {
  const elevationNoise = noise2D(seed);
  const moistureNoise = noise2D(seed + 1000);
  const rng = seededRandom(seed + 2000);
  const grid: CivTile[][] = [];
  const scale = 0.08;

  for (let y = 0; y < gridSize; y++) {
    const row: CivTile[] = [];
    for (let x = 0; x < gridSize; x++) {
      const elevation = fbm(elevationNoise, x * scale, y * scale, 4);
      const moisture = fbm(moistureNoise, x * scale * 1.3, y * scale * 1.3, 3);

      // Push edges toward water for island feel
      const edgeDist = Math.min(x, y, gridSize - 1 - x, gridSize - 1 - y) / (gridSize * 0.15);
      const edgeFalloff = Math.min(1, edgeDist);
      const adjustedElevation = elevation * edgeFalloff - (1 - edgeFalloff) * 0.3;

      const terrain = classifyTerrain(adjustedElevation, moisture);
      const resource = placeResource(terrain, rng);

      row.push({
        x, y, terrain, resource,
        ownerId: null, cityId: null, unitId: null,
      });
    }
    grid.push(row);
  }

  // Ensure start positions are viable (use scaled positions if provided)
  const startPositions = scaledStartPositions ?? Object.fromEntries(
    Object.entries(ruleset.civilizations).map(([id, civDef]) => [id, civDef.startPosition])
  );
  for (const [, pos] of Object.entries(startPositions)) {
    ensureStartViable(grid, pos, gridSize);
  }

  return grid;
}

let nextUnitId = 1;
function genUnitId(): string {
  return `u${nextUnitId++}`;
}

let nextCityId = 1;
function genCityId(): string {
  return `c${nextCityId++}`;
}

let nextBarbarianCampId = 1;
function genBarbarianCampId(): string {
  return `bcamp${nextBarbarianCampId++}`;
}

function placeBarbarianCamps(
  grid: CivTile[][],
  gridSize: number,
  startPositions: Record<string, { x: number; y: number }>,
  rng: () => number
): Record<string, BarbarianCamp> {
  const camps: Record<string, BarbarianCamp> = {};
  const numCamps = 2 + Math.floor(rng() * 3);
  const minDistFromCiv = Math.floor(gridSize * 0.25);
  const civPositions = Object.values(startPositions);
  const validPositions: { x: number; y: number }[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (tile.terrain === 'water' || tile.terrain === 'mountain') continue;
      if (tile.ownerId || tile.cityId) continue;
      let farEnough = true;
      for (const civPos of civPositions) {
        const dist = Math.abs(x - civPos.x) + Math.abs(y - civPos.y);
        if (dist < minDistFromCiv) { farEnough = false; break; }
      }
      if (farEnough) validPositions.push({ x, y });
    }
  }

  for (let i = validPositions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [validPositions[i], validPositions[j]] = [validPositions[j], validPositions[i]];
  }

  const placedCamps: { x: number; y: number }[] = [];
  for (let i = 0; i < numCamps && validPositions.length > 0; i++) {
    let pos: { x: number; y: number } | null = null;
    for (let j = 0; j < validPositions.length; j++) {
      const candidate = validPositions[j];
      let farFromOtherCamps = true;
      for (const placed of placedCamps) {
        const dist = Math.abs(candidate.x - placed.x) + Math.abs(candidate.y - placed.y);
        if (dist < 5) { farFromOtherCamps = false; break; }
      }
      if (farFromOtherCamps) { pos = candidate; validPositions.splice(j, 1); break; }
    }
    if (pos) {
      const campId = genBarbarianCampId();
      camps[campId] = { id: campId, x: pos.x, y: pos.y, strength: 50 + Math.floor(rng() * 30) };
      placedCamps.push(pos);
    }
  }
  return camps;
}

export function createInitialGameState(seed: number, gridSize: number = 30, maxTurns: number = 20): CivGameState {
  nextUnitId = 1;
  nextCityId = 1;
  nextBarbarianCampId = 1;

  // Get scaled start positions for this map size
  const scaledStartPositions = getScaledStartPositions(gridSize);

  const grid = generateMap(seed, gridSize, scaledStartPositions);
  const rng = seededRandom(seed + 5000); // RNG for barbarian camps and natural wonders
  const barbarianCamps = placeBarbarianCamps(grid, gridSize, scaledStartPositions, rng);
  const naturalWonders = placeNaturalWonders(grid, gridSize, scaledStartPositions, rng, 3);
  const civIds = ruleset.getCivIds();

  const units: Record<string, Unit> = {};
  const cities: Record<string, City> = {};
  const civilizations: Record<string, Civilization> = {};

  for (const civId of civIds) {
    const civDef = ruleset.getCiv(civId)!;
    // Use scaled position instead of the default from ruleset
    const pos = scaledStartPositions[civId] ?? civDef.startPosition;

    // Create starting city
    const cityId = genCityId();
    const cityName = civDef.cityNames[0];
    cities[cityId] = {
      id: cityId, name: cityName, ownerId: civId,
      x: pos.x, y: pos.y, population: 1,
      goldPerTurn: 3, foodPerTurn: 2, productionPerTurn: 2,
      sciencePerTurn: 0,
      culturePerTurn: 1,
      cultureStored: 0,
      borderRadius: 1,
      buildings: [], defense: 5,
      localHappiness: 0,
    };
    grid[pos.y][pos.x].cityId = cityId;
    grid[pos.y][pos.x].ownerId = civId;

    // Claim territory around city using borderRadius
    const initialRadius = cities[cityId].borderRadius;
    for (let dy = -initialRadius; dy <= initialRadius; dy++) {
      for (let dx = -initialRadius; dx <= initialRadius; dx++) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          if (Math.abs(dx) + Math.abs(dy) <= initialRadius) {
            grid[ny][nx].ownerId = civId;
          }
        }
      }
    }

    // Create starting units from ruleset
    const startUnitTypes = civDef.startUnits;
    const unitPositions = [
      { x: pos.x + 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x, y: pos.y - 1 },
    ];

    const unitIds: string[] = [];
    for (let i = 0; i < startUnitTypes.length && i < unitPositions.length; i++) {
      const upos = unitPositions[i];
      const unitType = startUnitTypes[i];
      const unitDef = ruleset.getUnit(unitType);
      if (!unitDef) continue;

      if (upos.x >= 0 && upos.x < gridSize && upos.y >= 0 && upos.y < gridSize
        && grid[upos.y][upos.x].terrain !== 'water' && grid[upos.y][upos.x].terrain !== 'mountain') {
        const unitId = genUnitId();
        units[unitId] = {
          id: unitId, type: unitType, ownerId: civId,
          x: upos.x, y: upos.y,
          hp: unitDef.hp, maxHp: unitDef.hp,
          attack: unitDef.attack, defense: unitDef.defense,
          movement: unitDef.movement, movementLeft: unitDef.movement,
        };
        grid[upos.y][upos.x].unitId = unitId;
        unitIds.push(unitId);
      }
    }

    // Calculate known tiles (fog of war initial reveal)
    const knownTiles = new Set<string>();
    // City reveals radius 3
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          knownTiles.add(`${nx},${ny}`);
        }
      }
    }
    // Units reveal their own visibility
    for (const uid of unitIds) {
      const u = units[uid];
      const unitDef = ruleset.getUnit(u.type);
      const range = unitDef?.vision ?? 2;
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          const nx = u.x + dx;
          const ny = u.y + dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            knownTiles.add(`${nx},${ny}`);
          }
        }
      }
    }

    // Initialize relationships as neutral with all other civs
    const relationships: Record<string, 'neutral'> = {};
    for (const otherId of civIds) {
      relationships[otherId] = 'neutral';
    }

    civilizations[civId] = {
      id: civId, name: civDef.name, leaderName: civDef.leader,
      color: civDef.color, secondaryColor: civDef.secondaryColor,
      gold: 20,
      cities: [cityId], units: unitIds,
      knownTiles: Array.from(knownTiles),
      relationships,
      personality: civDef.personality,
      isAlive: true, score: 0,
      researchedTechs: [],
      currentResearch: null,
      sciencePerTurn: 1,
      goldenAgePoints: 0,
      goldenAgeTurns: 0,
      goldenAgesCompleted: 0,
      greatPeopleProgress: {
        scientist: 0,
        artist: 0,
        general: 0,
        merchant: 0,
        engineer: 0,
      },
      greatPeopleThresholds: {
        scientist: 100,
        artist: 100,
        general: 100,
        merchant: 100,
        engineer: 100,
      },
      government: 'despotism',
      anarchyTurns: 0,
      happiness: 10,
      warWeariness: 0,
      spaceshipParts: {
        booster: false,
        cockpit: false,
        engine: false,
      },
    };
  }

  return {
    id: `game_${seed}`,
    turn: 1,
    maxTurns,
    phase: 'idle',
    grid,
    gridSize,
    civilizations,
    units,
    cities,
    tradeRoutes: {},
    naturalWonders,
    barbarianCamps,
    barbarianUnits: [],
    diplomacyLog: [],
    currentNarration: 'The ancient world stirs. Three great civilizations rise from the mist of time...',
    combatLog: [],
    combatEffects: [],
    notifications: [],
    turnEvents: [],
    cameraEvents: [],
    winner: null,
  };
}
