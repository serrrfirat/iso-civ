import { CivTile, TerrainType, ResourceType, CivId, CivGameState, Civilization, Unit, City } from '@/games/civ/types';

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
      case 'hills': return 'production';
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

const START_POSITIONS_30: Array<{ x: number; y: number }> = [
  { x: 5, y: 5 },      // top-left (Rome)
  { x: 24, y: 5 },     // top-right (Egypt)
  { x: 14, y: 24 },    // bottom-center (Mongolia)
];

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
// City names per civilization
// ============================================================================

const CITY_NAMES: Record<CivId, string[]> = {
  rome: ['Roma', 'Mediolanum', 'Neapolis', 'Florentia', 'Venetia'],
  egypt: ['Thebes', 'Memphis', 'Alexandria', 'Heliopolis', 'Giza'],
  mongolia: ['Karakorum', 'Sarai', 'Almaliq', 'Shangdu', 'Avarga'],
};

// ============================================================================
// Game state generation
// ============================================================================

export function generateMap(seed: number, gridSize: number = 30): CivTile[][] {
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

  // Ensure start positions are viable
  for (const pos of START_POSITIONS_30) {
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

export function createInitialGameState(seed: number, gridSize: number = 30, maxTurns: number = 20): CivGameState {
  nextUnitId = 1;
  nextCityId = 1;

  const grid = generateMap(seed, gridSize);
  const civIds: CivId[] = ['rome', 'egypt', 'mongolia'];
  const starts = START_POSITIONS_30;

  const units: Record<string, Unit> = {};
  const cities: Record<string, City> = {};
  const civilizations: Record<CivId, Civilization> = {} as Record<CivId, Civilization>;

  const civConfigs: Record<CivId, { name: string; leader: string; personality: string }> = {
    rome: { name: 'Roman Empire', leader: 'Caesar Augustus', personality: 'militaristic and diplomatic' },
    egypt: { name: 'Kingdom of Egypt', leader: 'Cleopatra VII', personality: 'scientific and trade-focused' },
    mongolia: { name: 'Mongol Empire', leader: 'Genghis Khan', personality: 'aggressive and expansionist' },
  };

  for (let i = 0; i < civIds.length; i++) {
    const civId = civIds[i];
    const pos = starts[i];
    const config = civConfigs[civId];

    // Create starting city
    const cityId = genCityId();
    const cityName = CITY_NAMES[civId][0];
    cities[cityId] = {
      id: cityId, name: cityName, ownerId: civId,
      x: pos.x, y: pos.y, population: 1,
      goldPerTurn: 3, foodPerTurn: 2, productionPerTurn: 2,
      buildings: [], defense: 5,
    };
    grid[pos.y][pos.x].cityId = cityId;
    grid[pos.y][pos.x].ownerId = civId;

    // Claim territory around city (radius 2)
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          if (Math.abs(dx) + Math.abs(dy) <= 2) {
            grid[ny][nx].ownerId = civId;
          }
        }
      }
    }

    // Create starting units
    const unitPositions = [
      { x: pos.x + 1, y: pos.y, type: 'warrior' as const },
      { x: pos.x, y: pos.y + 1, type: 'scout' as const },
    ];

    const unitIds: string[] = [];
    for (const upos of unitPositions) {
      if (upos.x >= 0 && upos.x < gridSize && upos.y >= 0 && upos.y < gridSize
        && grid[upos.y][upos.x].terrain !== 'water' && grid[upos.y][upos.x].terrain !== 'mountain') {
        const unitId = genUnitId();
        const stats = UNIT_STATS[upos.type];
        units[unitId] = {
          id: unitId, type: upos.type, ownerId: civId,
          x: upos.x, y: upos.y,
          hp: stats.maxHp, maxHp: stats.maxHp,
          attack: stats.attack, defense: stats.defense,
          movement: stats.movement, movementLeft: stats.movement,
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
      const range = u.type === 'scout' ? 4 : 2;
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

    const relationships: Record<CivId, 'neutral'> = { rome: 'neutral', egypt: 'neutral', mongolia: 'neutral' };

    civilizations[civId] = {
      id: civId, name: config.name, leaderName: config.leader,
      color: CIV_VISUAL[civId].primary, secondaryColor: CIV_VISUAL[civId].secondary,
      gold: 20,
      cities: [cityId], units: unitIds,
      knownTiles: Array.from(knownTiles),
      relationships,
      personality: config.personality,
      isAlive: true, score: 0,
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
    diplomacyLog: [],
    currentNarration: 'The ancient world stirs. Three great civilizations rise from the mist of time...',
    combatLog: [],
    winner: null,
  };
}

// ============================================================================
// Unit stats (imported from types for convenience)
// ============================================================================

export const UNIT_STATS: Record<string, { maxHp: number; attack: number; defense: number; movement: number }> = {
  warrior: { maxHp: 100, attack: 10, defense: 8, movement: 2 },
  archer:  { maxHp: 80, attack: 8, defense: 5, movement: 2 },
  scout:   { maxHp: 60, attack: 4, defense: 3, movement: 4 },
  settler: { maxHp: 50, attack: 0, defense: 2, movement: 2 },
};

const CIV_VISUAL: Record<CivId, { primary: string; secondary: string }> = {
  rome: { primary: '#DC2626', secondary: '#FCA5A5' },
  egypt: { primary: '#D97706', secondary: '#FDE68A' },
  mongolia: { primary: '#2563EB', secondary: '#93C5FD' },
};
