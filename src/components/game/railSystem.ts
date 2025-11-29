/**
 * Rail System - Railway track rendering and train management
 * Handles track connections, curves, spurs, and multi-carriage trains
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, CarDirection } from './types';

// ============================================================================
// Types
// ============================================================================

/** Rail track connection pattern */
export type RailConnection = {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
};

/** Track segment type based on connections */
export type TrackType = 
  | 'straight_ns'     // North-South straight
  | 'straight_ew'     // East-West straight
  | 'curve_ne'        // Curves connecting N-E
  | 'curve_nw'        // Curves connecting N-W
  | 'curve_se'        // Curves connecting S-E
  | 'curve_sw'        // Curves connecting S-W
  | 'junction_t_n'    // T-junction, no north
  | 'junction_t_e'    // T-junction, no east
  | 'junction_t_s'    // T-junction, no south
  | 'junction_t_w'    // T-junction, no west
  | 'junction_cross'  // 4-way crossing
  | 'terminus_n'      // Dead-end facing north
  | 'terminus_e'      // Dead-end facing east
  | 'terminus_s'      // Dead-end facing south
  | 'terminus_w'      // Dead-end facing west
  | 'single';         // Isolated single track

/** Train carriage type */
export type CarriageType = 'locomotive' | 'passenger' | 'freight_box' | 'freight_tank' | 'freight_flat' | 'caboose';

/** Train type */
export type TrainType = 'passenger' | 'freight';

/** Individual train carriage */
export interface TrainCarriage {
  type: CarriageType;
  color: string;
  // Position along the train's path (0-1 within current tile segment)
  progress: number;
  // Current tile position
  tileX: number;
  tileY: number;
  // Direction of travel
  direction: CarDirection;
}

/** Complete train with multiple carriages */
export interface Train {
  id: number;
  type: TrainType;
  carriages: TrainCarriage[];
  // Lead locomotive position
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  // Path for the train
  path: { x: number; y: number }[];
  pathIndex: number;
  // Lifecycle
  age: number;
  maxAge: number;
  // Visual
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Rail track colors */
export const RAIL_COLORS = {
  BALLAST: '#8B7355',           // Track bed (gravel/ballast)
  BALLAST_DARK: '#6B5344',      // Darker ballast edges
  TIE: '#4a3728',               // Wooden rail ties (sleepers)
  TIE_HIGHLIGHT: '#5d4a3a',     // Lighter tie surface
  RAIL: '#4a4a4a',              // Steel rail
  RAIL_HIGHLIGHT: '#6a6a6a',    // Rail highlight
  RAIL_SHADOW: '#2a2a2a',       // Rail shadow
};

/** Locomotive colors (various liveries) */
export const LOCOMOTIVE_COLORS = [
  '#1e40af', // Blue
  '#dc2626', // Red
  '#059669', // Green
  '#7c3aed', // Purple
  '#ea580c', // Orange
  '#0891b2', // Cyan
];

/** Freight car colors */
export const FREIGHT_COLORS = [
  '#8B4513', // Brown
  '#696969', // Gray
  '#2F4F4F', // Dark slate
  '#8B0000', // Dark red
  '#006400', // Dark green
  '#4682B4', // Steel blue
];

/** Passenger car colors */
export const PASSENGER_COLORS = [
  '#C0C0C0', // Silver
  '#1e40af', // Blue
  '#059669', // Green
  '#7c3aed', // Purple
];

/** Track gauge (width between rails) as ratio of tile width */
export const TRACK_GAUGE_RATIO = 0.12;

/** Ballast width as ratio of tile width */
export const BALLAST_WIDTH_RATIO = 0.24;

/** Number of ties per tile */
export const TIES_PER_TILE = 6;

/** Train car dimensions */
export const TRAIN_CAR = {
  LOCOMOTIVE_LENGTH: 16,
  CAR_LENGTH: 14,
  CAR_WIDTH: 6,
  CAR_SPACING: 2, // Gap between cars
};

// ============================================================================
// Rail Analysis Functions
// ============================================================================

/**
 * Check if a tile is a rail track
 */
export function isRailTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail';
}

/**
 * Check if a tile is a rail station
 */
export function isRailStationTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail_station';
}

/**
 * Get adjacent rail connections for a tile
 */
export function getAdjacentRail(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RailConnection {
  return {
    north: isRailTile(grid, gridSize, x - 1, y) || isRailStationTile(grid, gridSize, x - 1, y),
    east: isRailTile(grid, gridSize, x, y - 1) || isRailStationTile(grid, gridSize, x, y - 1),
    south: isRailTile(grid, gridSize, x + 1, y) || isRailStationTile(grid, gridSize, x + 1, y),
    west: isRailTile(grid, gridSize, x, y + 1) || isRailStationTile(grid, gridSize, x, y + 1),
  };
}

/**
 * Determine track type based on connections
 */
export function getTrackType(connections: RailConnection): TrackType {
  const { north, east, south, west } = connections;
  const count = [north, east, south, west].filter(Boolean).length;

  // 4-way crossing
  if (count === 4) return 'junction_cross';

  // T-junctions (3 connections)
  if (count === 3) {
    if (!north) return 'junction_t_n';
    if (!east) return 'junction_t_e';
    if (!south) return 'junction_t_s';
    if (!west) return 'junction_t_w';
  }

  // Straight tracks (2 opposite connections)
  if (north && south && !east && !west) return 'straight_ns';
  if (east && west && !north && !south) return 'straight_ew';

  // Curves (2 adjacent connections)
  if (north && east && !south && !west) return 'curve_ne';
  if (north && west && !south && !east) return 'curve_nw';
  if (south && east && !north && !west) return 'curve_se';
  if (south && west && !north && !east) return 'curve_sw';

  // Dead ends (1 connection)
  if (count === 1) {
    if (north) return 'terminus_s';  // Track faces south (connects to north)
    if (east) return 'terminus_w';   // Track faces west (connects to east)
    if (south) return 'terminus_n';  // Track faces north (connects to south)
    if (west) return 'terminus_e';   // Track faces east (connects to west)
  }

  // Isolated or unconnected
  return 'single';
}

// ============================================================================
// Track Drawing Functions
// ============================================================================

/**
 * Draw the ballast (gravel bed) foundation for tracks
 */
function drawBallast(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  trackType: TrackType,
  _zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const ballastW = w * BALLAST_WIDTH_RATIO;

  // Calculate edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  // Calculate direction vectors from center to each edge
  const toNorthX = (northEdgeX - cx);
  const toNorthY = (northEdgeY - cy);
  const northLen = Math.hypot(toNorthX, toNorthY);
  const northDx = toNorthX / northLen;
  const northDy = toNorthY / northLen;

  const toEastX = (eastEdgeX - cx);
  const toEastY = (eastEdgeY - cy);
  const eastLen = Math.hypot(toEastX, toEastY);
  const eastDx = toEastX / eastLen;
  const eastDy = toEastY / eastLen;

  const toSouthX = (southEdgeX - cx);
  const toSouthY = (southEdgeY - cy);
  const southLen = Math.hypot(toSouthX, toSouthY);
  const southDx = toSouthX / southLen;
  const southDy = toSouthY / southLen;

  const toWestX = (westEdgeX - cx);
  const toWestY = (westEdgeY - cy);
  const westLen = Math.hypot(toWestX, toWestY);
  const westDx = toWestX / westLen;
  const westDy = toWestY / westLen;

  // Get perpendicular vectors for ballast width
  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });

  ctx.fillStyle = RAIL_COLORS.BALLAST;

  // Draw ballast segments based on track type
  const drawBallastSegment = (
    fromX: number, fromY: number,
    toX: number, toY: number,
    dirDx: number, dirDy: number
  ) => {
    const perp = getPerp(dirDx, dirDy);
    const halfW = ballastW / 2;
    
    ctx.beginPath();
    ctx.moveTo(fromX + perp.nx * halfW, fromY + perp.ny * halfW);
    ctx.lineTo(toX + perp.nx * halfW, toY + perp.ny * halfW);
    ctx.lineTo(toX - perp.nx * halfW, toY - perp.ny * halfW);
    ctx.lineTo(fromX - perp.nx * halfW, fromY - perp.ny * halfW);
    ctx.closePath();
    ctx.fill();
  };

  // Draw center diamond for intersections/junctions
  const drawCenterBallast = () => {
    const size = ballastW * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
    ctx.fill();
  };

  // Draw ballast based on track type
  switch (trackType) {
    case 'straight_ns':
      drawBallastSegment(northEdgeX, northEdgeY, southEdgeX, southEdgeY, southDx, southDy);
      break;
    case 'straight_ew':
      drawBallastSegment(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, westDx, westDy);
      break;
    case 'curve_ne':
      drawBallastSegment(cx, cy, northEdgeX, northEdgeY, northDx, northDy);
      drawBallastSegment(cx, cy, eastEdgeX, eastEdgeY, eastDx, eastDy);
      drawCenterBallast();
      break;
    case 'curve_nw':
      drawBallastSegment(cx, cy, northEdgeX, northEdgeY, northDx, northDy);
      drawBallastSegment(cx, cy, westEdgeX, westEdgeY, westDx, westDy);
      drawCenterBallast();
      break;
    case 'curve_se':
      drawBallastSegment(cx, cy, southEdgeX, southEdgeY, southDx, southDy);
      drawBallastSegment(cx, cy, eastEdgeX, eastEdgeY, eastDx, eastDy);
      drawCenterBallast();
      break;
    case 'curve_sw':
      drawBallastSegment(cx, cy, southEdgeX, southEdgeY, southDx, southDy);
      drawBallastSegment(cx, cy, westEdgeX, westEdgeY, westDx, westDy);
      drawCenterBallast();
      break;
    case 'junction_t_n':
      drawBallastSegment(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, westDx, westDy);
      drawBallastSegment(cx, cy, southEdgeX, southEdgeY, southDx, southDy);
      drawCenterBallast();
      break;
    case 'junction_t_e':
      drawBallastSegment(northEdgeX, northEdgeY, southEdgeX, southEdgeY, southDx, southDy);
      drawBallastSegment(cx, cy, westEdgeX, westEdgeY, westDx, westDy);
      drawCenterBallast();
      break;
    case 'junction_t_s':
      drawBallastSegment(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, westDx, westDy);
      drawBallastSegment(cx, cy, northEdgeX, northEdgeY, northDx, northDy);
      drawCenterBallast();
      break;
    case 'junction_t_w':
      drawBallastSegment(northEdgeX, northEdgeY, southEdgeX, southEdgeY, southDx, southDy);
      drawBallastSegment(cx, cy, eastEdgeX, eastEdgeY, eastDx, eastDy);
      drawCenterBallast();
      break;
    case 'junction_cross':
      drawBallastSegment(northEdgeX, northEdgeY, southEdgeX, southEdgeY, southDx, southDy);
      drawBallastSegment(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, westDx, westDy);
      drawCenterBallast();
      break;
    case 'terminus_n':
      drawBallastSegment(cx, cy, southEdgeX, southEdgeY, southDx, southDy);
      drawCenterBallast();
      break;
    case 'terminus_e':
      drawBallastSegment(cx, cy, westEdgeX, westEdgeY, westDx, westDy);
      drawCenterBallast();
      break;
    case 'terminus_s':
      drawBallastSegment(cx, cy, northEdgeX, northEdgeY, northDx, northDy);
      drawCenterBallast();
      break;
    case 'terminus_w':
      drawBallastSegment(cx, cy, eastEdgeX, eastEdgeY, eastDx, eastDy);
      drawCenterBallast();
      break;
    case 'single':
      // Just draw center diamond for isolated track
      const singleSize = ballastW;
      ctx.beginPath();
      ctx.moveTo(cx, cy - singleSize);
      ctx.lineTo(cx + singleSize, cy);
      ctx.lineTo(cx, cy + singleSize);
      ctx.lineTo(cx - singleSize, cy);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

/**
 * Draw rail ties (sleepers) perpendicular to track direction
 */
function drawTies(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  trackType: TrackType,
  zoom: number
): void {
  if (zoom < 0.5) return; // Skip ties at low zoom for performance

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tieWidth = w * 0.025;
  const tieLength = w * BALLAST_WIDTH_RATIO * 0.9;

  // Calculate edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  ctx.fillStyle = RAIL_COLORS.TIE;

  // Draw ties along a track segment
  const drawTiesAlongSegment = (
    fromX: number, fromY: number,
    toX: number, toY: number,
    numTies: number
  ) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy);
    const dirX = dx / len;
    const dirY = dy / len;
    // Perpendicular for tie orientation
    const perpX = -dirY;
    const perpY = dirX;

    for (let i = 0; i < numTies; i++) {
      const t = (i + 0.5) / numTies;
      const tieX = fromX + dx * t;
      const tieY = fromY + dy * t;

      // Draw tie as small isometric rectangle
      const halfLen = tieLength / 2;
      const halfWidth = tieWidth / 2;

      ctx.beginPath();
      ctx.moveTo(tieX + perpX * halfLen - dirX * halfWidth, tieY + perpY * halfLen - dirY * halfWidth);
      ctx.lineTo(tieX + perpX * halfLen + dirX * halfWidth, tieY + perpY * halfLen + dirY * halfWidth);
      ctx.lineTo(tieX - perpX * halfLen + dirX * halfWidth, tieY - perpY * halfLen + dirY * halfWidth);
      ctx.lineTo(tieX - perpX * halfLen - dirX * halfWidth, tieY - perpY * halfLen - dirY * halfWidth);
      ctx.closePath();
      ctx.fill();
    }
  };

  // Draw ties based on track type
  const tiesHalf = Math.ceil(TIES_PER_TILE / 2);

  switch (trackType) {
    case 'straight_ns':
      drawTiesAlongSegment(northEdgeX, northEdgeY, southEdgeX, southEdgeY, TIES_PER_TILE);
      break;
    case 'straight_ew':
      drawTiesAlongSegment(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, TIES_PER_TILE);
      break;
    case 'curve_ne':
      drawTiesAlongSegment(cx, cy, northEdgeX, northEdgeY, tiesHalf);
      drawTiesAlongSegment(cx, cy, eastEdgeX, eastEdgeY, tiesHalf);
      break;
    case 'curve_nw':
      drawTiesAlongSegment(cx, cy, northEdgeX, northEdgeY, tiesHalf);
      drawTiesAlongSegment(cx, cy, westEdgeX, westEdgeY, tiesHalf);
      break;
    case 'curve_se':
      drawTiesAlongSegment(cx, cy, southEdgeX, southEdgeY, tiesHalf);
      drawTiesAlongSegment(cx, cy, eastEdgeX, eastEdgeY, tiesHalf);
      break;
    case 'curve_sw':
      drawTiesAlongSegment(cx, cy, southEdgeX, southEdgeY, tiesHalf);
      drawTiesAlongSegment(cx, cy, westEdgeX, westEdgeY, tiesHalf);
      break;
    case 'junction_t_n':
      drawTiesAlongSegment(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, TIES_PER_TILE);
      drawTiesAlongSegment(cx, cy, southEdgeX, southEdgeY, tiesHalf);
      break;
    case 'junction_t_e':
      drawTiesAlongSegment(northEdgeX, northEdgeY, southEdgeX, southEdgeY, TIES_PER_TILE);
      drawTiesAlongSegment(cx, cy, westEdgeX, westEdgeY, tiesHalf);
      break;
    case 'junction_t_s':
      drawTiesAlongSegment(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, TIES_PER_TILE);
      drawTiesAlongSegment(cx, cy, northEdgeX, northEdgeY, tiesHalf);
      break;
    case 'junction_t_w':
      drawTiesAlongSegment(northEdgeX, northEdgeY, southEdgeX, southEdgeY, TIES_PER_TILE);
      drawTiesAlongSegment(cx, cy, eastEdgeX, eastEdgeY, tiesHalf);
      break;
    case 'junction_cross':
      drawTiesAlongSegment(northEdgeX, northEdgeY, southEdgeX, southEdgeY, TIES_PER_TILE);
      drawTiesAlongSegment(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY, TIES_PER_TILE);
      break;
    case 'terminus_n':
      drawTiesAlongSegment(cx, cy, southEdgeX, southEdgeY, tiesHalf);
      break;
    case 'terminus_e':
      drawTiesAlongSegment(cx, cy, westEdgeX, westEdgeY, tiesHalf);
      break;
    case 'terminus_s':
      drawTiesAlongSegment(cx, cy, northEdgeX, northEdgeY, tiesHalf);
      break;
    case 'terminus_w':
      drawTiesAlongSegment(cx, cy, eastEdgeX, eastEdgeY, tiesHalf);
      break;
  }
}

/**
 * Draw the two parallel steel rails
 */
function drawRails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  trackType: TrackType,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const railGauge = w * TRACK_GAUGE_RATIO;
  const railWidth = zoom >= 0.7 ? 1.5 : 1;

  // Calculate edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  // Draw two parallel rails along a segment
  const drawRailPair = (
    fromX: number, fromY: number,
    toX: number, toY: number
  ) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy);
    const dirX = dx / len;
    const dirY = dy / len;
    const perpX = -dirY;
    const perpY = dirX;
    const halfGauge = railGauge / 2;

    // Draw shadow rails first
    ctx.strokeStyle = RAIL_COLORS.RAIL_SHADOW;
    ctx.lineWidth = railWidth + 0.5;
    ctx.lineCap = 'round';

    // Left rail shadow
    ctx.beginPath();
    ctx.moveTo(fromX + perpX * halfGauge + 0.5, fromY + perpY * halfGauge + 0.5);
    ctx.lineTo(toX + perpX * halfGauge + 0.5, toY + perpY * halfGauge + 0.5);
    ctx.stroke();

    // Right rail shadow
    ctx.beginPath();
    ctx.moveTo(fromX - perpX * halfGauge + 0.5, fromY - perpY * halfGauge + 0.5);
    ctx.lineTo(toX - perpX * halfGauge + 0.5, toY - perpY * halfGauge + 0.5);
    ctx.stroke();

    // Main rails
    ctx.strokeStyle = RAIL_COLORS.RAIL;
    ctx.lineWidth = railWidth;

    // Left rail
    ctx.beginPath();
    ctx.moveTo(fromX + perpX * halfGauge, fromY + perpY * halfGauge);
    ctx.lineTo(toX + perpX * halfGauge, toY + perpY * halfGauge);
    ctx.stroke();

    // Right rail
    ctx.beginPath();
    ctx.moveTo(fromX - perpX * halfGauge, fromY - perpY * halfGauge);
    ctx.lineTo(toX - perpX * halfGauge, toY - perpY * halfGauge);
    ctx.stroke();

    // Rail highlights (for zoom > 0.8)
    if (zoom >= 0.8) {
      ctx.strokeStyle = RAIL_COLORS.RAIL_HIGHLIGHT;
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(fromX + perpX * halfGauge - 0.3, fromY + perpY * halfGauge - 0.3);
      ctx.lineTo(toX + perpX * halfGauge - 0.3, toY + perpY * halfGauge - 0.3);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(fromX - perpX * halfGauge - 0.3, fromY - perpY * halfGauge - 0.3);
      ctx.lineTo(toX - perpX * halfGauge - 0.3, toY - perpY * halfGauge - 0.3);
      ctx.stroke();
    }
  };

  // Draw rails based on track type
  switch (trackType) {
    case 'straight_ns':
      drawRailPair(northEdgeX, northEdgeY, southEdgeX, southEdgeY);
      break;
    case 'straight_ew':
      drawRailPair(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY);
      break;
    case 'curve_ne':
      drawRailPair(cx, cy, northEdgeX, northEdgeY);
      drawRailPair(cx, cy, eastEdgeX, eastEdgeY);
      break;
    case 'curve_nw':
      drawRailPair(cx, cy, northEdgeX, northEdgeY);
      drawRailPair(cx, cy, westEdgeX, westEdgeY);
      break;
    case 'curve_se':
      drawRailPair(cx, cy, southEdgeX, southEdgeY);
      drawRailPair(cx, cy, eastEdgeX, eastEdgeY);
      break;
    case 'curve_sw':
      drawRailPair(cx, cy, southEdgeX, southEdgeY);
      drawRailPair(cx, cy, westEdgeX, westEdgeY);
      break;
    case 'junction_t_n':
      drawRailPair(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY);
      drawRailPair(cx, cy, southEdgeX, southEdgeY);
      break;
    case 'junction_t_e':
      drawRailPair(northEdgeX, northEdgeY, southEdgeX, southEdgeY);
      drawRailPair(cx, cy, westEdgeX, westEdgeY);
      break;
    case 'junction_t_s':
      drawRailPair(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY);
      drawRailPair(cx, cy, northEdgeX, northEdgeY);
      break;
    case 'junction_t_w':
      drawRailPair(northEdgeX, northEdgeY, southEdgeX, southEdgeY);
      drawRailPair(cx, cy, eastEdgeX, eastEdgeY);
      break;
    case 'junction_cross':
      drawRailPair(northEdgeX, northEdgeY, southEdgeX, southEdgeY);
      drawRailPair(eastEdgeX, eastEdgeY, westEdgeX, westEdgeY);
      break;
    case 'terminus_n':
      drawRailPair(cx, cy, southEdgeX, southEdgeY);
      // Draw buffer stop
      drawBufferStop(ctx, cx, cy, 'north', zoom);
      break;
    case 'terminus_e':
      drawRailPair(cx, cy, westEdgeX, westEdgeY);
      drawBufferStop(ctx, cx, cy, 'east', zoom);
      break;
    case 'terminus_s':
      drawRailPair(cx, cy, northEdgeX, northEdgeY);
      drawBufferStop(ctx, cx, cy, 'south', zoom);
      break;
    case 'terminus_w':
      drawRailPair(cx, cy, eastEdgeX, eastEdgeY);
      drawBufferStop(ctx, cx, cy, 'west', zoom);
      break;
    case 'single':
      // Draw short stub rails in both NS and EW for isolated track
      const stubLen = w * 0.15;
      const nsDir = { x: (southEdgeX - northEdgeX), y: (southEdgeY - northEdgeY) };
      const nsLen = Math.hypot(nsDir.x, nsDir.y);
      nsDir.x /= nsLen;
      nsDir.y /= nsLen;
      drawRailPair(cx - nsDir.x * stubLen, cy - nsDir.y * stubLen, cx + nsDir.x * stubLen, cy + nsDir.y * stubLen);
      break;
  }
}

/**
 * Draw a buffer stop at track terminus
 */
function drawBufferStop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 'north' | 'east' | 'south' | 'west',
  zoom: number
): void {
  if (zoom < 0.6) return;

  const size = 4;
  const offset = 2;

  ctx.save();
  ctx.translate(x, y);

  // Rotate based on facing direction
  const rotations = {
    north: -Math.PI * 0.75,
    east: -Math.PI * 0.25,
    south: Math.PI * 0.25,
    west: Math.PI * 0.75,
  };
  ctx.rotate(rotations[facing]);

  // Draw buffer stop (red/white striped)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-size - offset, -size / 2, size, size);
  
  // White stripe
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-size - offset, -size / 4, size, size / 2);

  ctx.restore();
}

// ============================================================================
// Main Track Drawing Function
// ============================================================================

/**
 * Draw complete rail track at a tile position
 * This should be called AFTER the base tile is drawn
 */
export function drawRailTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  zoom: number
): void {
  // Get adjacent rail connections
  const connections = getAdjacentRail(grid, gridSize, gridX, gridY);
  
  // Determine track type
  const trackType = getTrackType(connections);

  // Draw layers in order: ballast (bottom), ties, rails (top)
  drawBallast(ctx, x, y, trackType, zoom);
  drawTies(ctx, x, y, trackType, zoom);
  drawRails(ctx, x, y, trackType, zoom);
}

// ============================================================================
// Train Pathfinding Functions
// ============================================================================

/**
 * Get available direction options from a rail tile
 */
export function getRailDirectionOptions(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection[] {
  const options: CarDirection[] = [];
  if (isRailTile(grid, gridSize, x - 1, y) || isRailStationTile(grid, gridSize, x - 1, y)) options.push('north');
  if (isRailTile(grid, gridSize, x, y - 1) || isRailStationTile(grid, gridSize, x, y - 1)) options.push('east');
  if (isRailTile(grid, gridSize, x + 1, y) || isRailStationTile(grid, gridSize, x + 1, y)) options.push('south');
  if (isRailTile(grid, gridSize, x, y + 1) || isRailStationTile(grid, gridSize, x, y + 1)) options.push('west');
  return options;
}

/**
 * Find all rail stations in the grid
 */
export function findRailStations(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number }[] {
  const stations: { x: number; y: number }[] = [];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === 'rail_station') {
        stations.push({ x, y });
      }
    }
  }
  
  return stations;
}

/**
 * Count rail tiles in the grid
 */
export function countRailTiles(
  grid: Tile[][],
  gridSize: number
): number {
  let count = 0;
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === 'rail') {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Find path on rail network between two points
 */
export function findPathOnRails(
  grid: Tile[][],
  gridSize: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number }[] | null {
  // BFS pathfinding on rail network
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: startX, y: startY, path: [{ x: startX, y: startY }] }
  ];
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);

  const directions = [
    { dx: -1, dy: 0 },  // north
    { dx: 0, dy: -1 },  // east
    { dx: 1, dy: 0 },   // south
    { dx: 0, dy: 1 },   // west
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === endX && current.y === endY) {
      return current.path;
    }

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;

      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      if (visited.has(key)) continue;
      if (!isRailTile(grid, gridSize, nx, ny) && !isRailStationTile(grid, gridSize, nx, ny)) continue;

      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      });
    }
  }

  return null;
}
