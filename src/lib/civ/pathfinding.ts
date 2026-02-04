import { CivTile, TerrainType, CivGameState } from '@/games/civ/types';

// Terrain movement costs
const TERRAIN_COST: Record<TerrainType, number> = {
  plains: 1,
  desert: 1,
  hills: 2,
  forest: 2,
  mountain: Infinity, // impassable
  water: Infinity,     // impassable
};

interface PathNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: PathNode | null;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

export function findPath(
  state: CivGameState,
  startX: number, startY: number,
  endX: number, endY: number,
  maxMovement: number,
): { x: number; y: number }[] | null {
  const { grid, gridSize } = state;

  if (endX < 0 || endX >= gridSize || endY < 0 || endY >= gridSize) return null;

  const endTerrain = grid[endY][endX].terrain;
  if (TERRAIN_COST[endTerrain] === Infinity) return null;

  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    x: startX, y: startY, g: 0,
    h: heuristic(startX, startY, endX, endY),
    f: heuristic(startX, startY, endX, endY),
    parent: null,
  };
  openSet.push(startNode);

  while (openSet.length > 0) {
    // Find lowest f-score
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i;
    }
    const current = openSet[lowestIdx];

    // Reached goal
    if (current.x === endX && current.y === endY) {
      const path: { x: number; y: number }[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    openSet.splice(lowestIdx, 1);
    closedSet.add(`${current.x},${current.y}`);

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
      if (closedSet.has(`${nx},${ny}`)) continue;

      const tileCost = TERRAIN_COST[grid[ny][nx].terrain];
      if (tileCost === Infinity) continue;

      const newG = current.g + tileCost;
      if (newG > maxMovement) continue; // Beyond movement range

      const existing = openSet.find(n => n.x === nx && n.y === ny);
      if (existing && newG >= existing.g) continue;

      const newNode: PathNode = {
        x: nx, y: ny, g: newG,
        h: heuristic(nx, ny, endX, endY),
        f: newG + heuristic(nx, ny, endX, endY),
        parent: current,
      };

      if (existing) {
        existing.g = newG;
        existing.f = newNode.f;
        existing.parent = current;
      } else {
        openSet.push(newNode);
      }
    }
  }

  return null; // No path found
}

export function getReachableTiles(
  state: CivGameState,
  startX: number, startY: number,
  maxMovement: number,
): { x: number; y: number; cost: number }[] {
  const { grid, gridSize } = state;
  const visited = new Map<string, number>();
  const queue: { x: number; y: number; cost: number }[] = [{ x: startX, y: startY, cost: 0 }];
  const result: { x: number; y: number; cost: number }[] = [];

  visited.set(`${startX},${startY}`, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

      const tileCost = TERRAIN_COST[grid[ny][nx].terrain];
      if (tileCost === Infinity) continue;

      const totalCost = current.cost + tileCost;
      if (totalCost > maxMovement) continue;

      const key = `${nx},${ny}`;
      if (visited.has(key) && visited.get(key)! <= totalCost) continue;

      visited.set(key, totalCost);
      result.push({ x: nx, y: ny, cost: totalCost });
      queue.push({ x: nx, y: ny, cost: totalCost });
    }
  }

  return result;
}

export { TERRAIN_COST };
