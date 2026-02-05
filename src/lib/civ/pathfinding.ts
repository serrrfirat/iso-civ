import { CivGameState, CivId } from '@/games/civ/types';
import { ruleset } from './ruleset';

interface PathNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: PathNode | null;
  inEnemyZoC: boolean; // whether this tile is in an enemy's zone of control
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

// Road movement cost (reduced from normal terrain cost)
const ROAD_MOVEMENT_COST = 0.5;

/**
 * Get the effective movement cost for a tile, considering road improvements.
 * Roads reduce movement cost to 0.5 regardless of terrain.
 */
function getTileMovementCost(state: CivGameState, x: number, y: number): number {
  const tile = state.grid[y][x];

  // Roads reduce movement cost to 0.5
  if (tile.improvement === 'road') {
    return ROAD_MOVEMENT_COST;
  }

  // Otherwise use normal terrain cost
  return ruleset.getMoveCost(tile.terrain);
}

// Unit classes that exert Zone of Control (military units only)
const ZOC_UNIT_CLASSES = ['melee', 'ranged', 'mounted', 'naval', 'siege'];

/**
 * Check if a unit type exerts Zone of Control.
 * Only military units (not scouts, workers, settlers, etc.) exert ZoC.
 */
export function unitExertsZoC(unitType: string): boolean {
  const unitDef = ruleset.getUnit(unitType);
  if (!unitDef) return false;
  return ZOC_UNIT_CLASSES.includes(unitDef.class);
}

/**
 * Check if a tile is in an enemy unit's Zone of Control.
 * Returns true if any adjacent tile has an enemy military unit.
 */
export function isInEnemyZoC(
  state: CivGameState,
  x: number,
  y: number,
  movingUnitOwnerId: CivId
): boolean {
  const { grid, gridSize, units } = state;

  for (const dir of DIRECTIONS) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;

    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

    const tile = grid[ny][nx];
    if (tile.unitId) {
      const unit = units[tile.unitId];
      if (unit && unit.ownerId !== movingUnitOwnerId && unitExertsZoC(unit.type)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find a path from start to end, respecting Zone of Control.
 * When entering a tile adjacent to an enemy military unit (ZoC tile),
 * movement must stop there - the unit cannot continue past that tile.
 *
 * @param movingUnitOwnerId - The owner of the unit that is moving (to determine enemies)
 */
export function findPath(
  state: CivGameState,
  startX: number, startY: number,
  endX: number, endY: number,
  maxMovement: number,
  movingUnitOwnerId?: CivId,
): { x: number; y: number }[] | null {
  const { grid, gridSize } = state;

  if (endX < 0 || endX >= gridSize || endY < 0 || endY >= gridSize) return null;

  const endTerrain = grid[endY][endX].terrain;
  if (ruleset.getMoveCost(endTerrain) === Infinity) return null;

  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    x: startX, y: startY, g: 0,
    h: heuristic(startX, startY, endX, endY),
    f: heuristic(startX, startY, endX, endY),
    parent: null,
    inEnemyZoC: false, // Start position doesn't block movement
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

    // Zone of Control: If current tile is in enemy ZoC, we cannot expand further
    // (movement must stop at this tile). Only check if we have a moving unit owner.
    if (current.inEnemyZoC) {
      continue; // Cannot continue movement from a ZoC tile
    }

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
      if (closedSet.has(`${nx},${ny}`)) continue;

      const tileCost = getTileMovementCost(state, nx, ny);
      if (tileCost === Infinity) continue;

      const newG = current.g + tileCost;
      if (newG > maxMovement) continue; // Beyond movement range

      const existing = openSet.find(n => n.x === nx && n.y === ny);
      if (existing && newG >= existing.g) continue;

      // Check if this new tile is in enemy Zone of Control
      const tileInZoC = movingUnitOwnerId
        ? isInEnemyZoC(state, nx, ny, movingUnitOwnerId)
        : false;

      const newNode: PathNode = {
        x: nx, y: ny, g: newG,
        h: heuristic(nx, ny, endX, endY),
        f: newG + heuristic(nx, ny, endX, endY),
        parent: current,
        inEnemyZoC: tileInZoC,
      };

      if (existing) {
        existing.g = newG;
        existing.f = newNode.f;
        existing.parent = current;
        existing.inEnemyZoC = tileInZoC;
      } else {
        openSet.push(newNode);
      }
    }
  }

  return null; // No path found
}

/**
 * Get all tiles reachable from start position within movement range.
 * Respects Zone of Control - tiles adjacent to enemy military units
 * can be entered but movement must stop there.
 *
 * @param movingUnitOwnerId - The owner of the unit that is moving (to determine enemies)
 */
export function getReachableTiles(
  state: CivGameState,
  startX: number, startY: number,
  maxMovement: number,
  movingUnitOwnerId?: CivId,
): { x: number; y: number; cost: number }[] {
  const { grid, gridSize } = state;
  const visited = new Map<string, { cost: number; inZoC: boolean }>();
  const queue: { x: number; y: number; cost: number; inZoC: boolean }[] = [
    { x: startX, y: startY, cost: 0, inZoC: false }
  ];
  const result: { x: number; y: number; cost: number }[] = [];

  visited.set(`${startX},${startY}`, { cost: 0, inZoC: false });

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Zone of Control: If current tile is in enemy ZoC, we cannot expand further
    if (current.inZoC) {
      continue;
    }

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

      const tileCost = getTileMovementCost(state, nx, ny);
      if (tileCost === Infinity) continue;

      const totalCost = current.cost + tileCost;
      if (totalCost > maxMovement) continue;

      const key = `${nx},${ny}`;
      const existingVisit = visited.get(key);
      if (existingVisit && existingVisit.cost <= totalCost) continue;

      // Check if this tile is in enemy Zone of Control
      const tileInZoC = movingUnitOwnerId
        ? isInEnemyZoC(state, nx, ny, movingUnitOwnerId)
        : false;

      visited.set(key, { cost: totalCost, inZoC: tileInZoC });
      result.push({ x: nx, y: ny, cost: totalCost });
      queue.push({ x: nx, y: ny, cost: totalCost, inZoC: tileInZoC });
    }
  }

  return result;
}
