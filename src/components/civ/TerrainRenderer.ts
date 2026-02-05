import { CivTile, TERRAIN_COLORS, RESOURCE_COLORS, CivId, CIV_COLORS, TerrainType, BarbarianCamp } from '@/games/civ/types';
import { getDiamondCorners } from '@/components/game/drawing';
import { spriteCache, getTerrainVariant, BUILDING_SPRITES, RESOURCE_SPRITES, MOUNTAIN_SPRITE, IMPROVEMENT_SPRITES } from '@/lib/civ/spriteLoader';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32; // 2:1 isometric ratio — matches the tileset sprites

// Sprite cell size in the spritesheet (tiles are 64x64 cells with 64x32 diamond inside)
const SPRITE_CELL = 64;

export function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * (TILE_WIDTH / 2),
    y: (gx + gy) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(sx: number, sy: number): { x: number; y: number } {
  // Adjust for the diamond being rendered at (TILE_WIDTH/2, 0) offset from
  // the gridToScreen origin (which returns the bounding box top-left).
  const ax = sx - TILE_WIDTH / 2;
  const x = (ax / (TILE_WIDTH / 2) + sy / (TILE_HEIGHT / 2)) / 2;
  const y = (sy / (TILE_HEIGHT / 2) - ax / (TILE_WIDTH / 2)) / 2;
  return { x: Math.floor(x), y: Math.floor(y) };
}

// ---------------------------------------------------------------------------
// Colored diamond fallback (used when sprites aren't loaded or for special terrain)
// ---------------------------------------------------------------------------

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  colors: { top: string; left: string; right: string; stroke: string },
  drawStroke: boolean = true,
  height: number = 0,
): void {
  const corners = getDiamondCorners(x, y, TILE_WIDTH, TILE_HEIGHT);

  if (height > 0) {
    ctx.fillStyle = colors.left;
    ctx.beginPath();
    ctx.moveTo(corners.left.x, corners.left.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y + height);
    ctx.lineTo(corners.left.x, corners.left.y + height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.right;
    ctx.beginPath();
    ctx.moveTo(corners.right.x, corners.right.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y + height);
    ctx.lineTo(corners.right.x, corners.right.y + height);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();

  if (drawStroke) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function getTerrainHeight(terrain: TerrainType): number {
  switch (terrain) {
    case 'mountain': return 8;
    case 'hills': return 4;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Sprite-based terrain tile drawing
// ---------------------------------------------------------------------------

/** Whether a terrain type has a usable sprite in the tileset (water handled separately) */
function hasTerrainSprite(terrain: TerrainType): boolean {
  return terrain === 'plains' || terrain === 'forest' || terrain === 'desert'
    || terrain === 'hills' || terrain === 'mountain';
}

/**
 * Draw a terrain tile using the sprite tileset.
 * The 64x64 sprite cell contains a 64x32 isometric diamond centered vertically.
 * The diamond top in the sprite is at y=16 (cell center - 16).
 * We position the sprite so its diamond aligns with our grid position.
 */
function drawTerrainSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  terrain: TerrainType,
  gx: number, gy: number,
): boolean {
  // Desert, forest, and mountain use plains/hills as base tile
  const baseTerrain = terrain === 'forest' || terrain === 'desert' ? 'plains'
    : terrain === 'mountain' ? 'hills' : terrain;
  const { region, tileset } = getTerrainVariant(baseTerrain, gx, gy);

  const tilesetImg = spriteCache.getImage(tileset);
  if (!tilesetImg) return false;

  // Sprite diamond center is at (32, 32) in the 64x64 cell.
  // Our tile center is at (screenX + TILE_WIDTH/2, screenY + TILE_HEIGHT/2).
  const dx = screenX;
  const dy = screenY + TILE_HEIGHT / 2 - SPRITE_CELL / 2;

  spriteCache.drawSprite(ctx, tileset, region, dx, dy, SPRITE_CELL, SPRITE_CELL);

  // Desert: overlay sandy tint on top of grass base
  if (terrain === 'desert') {
    const corners = getDiamondCorners(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
    ctx.fillStyle = 'rgba(210, 180, 110, 0.65)';
    ctx.beginPath();
    ctx.moveTo(corners.top.x, corners.top.y);
    ctx.lineTo(corners.right.x, corners.right.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.left.x, corners.left.y);
    ctx.closePath();
    ctx.fill();
  }

  // Forest: overlay tree decoration
  if (terrain === 'forest') {
    const treeKey = (gx + gy) % 2 === 0 ? 'firtree' : 'oaktree';
    const treePath = BUILDING_SPRITES[treeKey];
    if (treePath) {
      const treeSize = 28;
      const treeCx = screenX + TILE_WIDTH / 2 - treeSize / 2;
      const treeCy = screenY - treeSize * 0.4;
      spriteCache.drawImage(ctx, treePath, treeCx, treeCy, treeSize, treeSize);
    }
  }

  // Mountain: overlay generated mountain sprite
  if (terrain === 'mountain') {
    const mountainImg = spriteCache.getImage(MOUNTAIN_SPRITE);
    if (mountainImg) {
      const mSize = 36;
      const mx = screenX + TILE_WIDTH / 2 - mSize / 2;
      const my = screenY - mSize * 0.5;
      spriteCache.drawImage(ctx, MOUNTAIN_SPRITE, mx, my, mSize, mSize);
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Resource icons (drawn directly on terrain with no background)
// ---------------------------------------------------------------------------

/** Resource color scheme for programmatic markers */
const RESOURCE_MARKER_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  food:       { bg: '#4CAF50', fg: '#FFF', label: 'F' },
  gold:       { bg: '#FFD700', fg: '#000', label: 'G' },
  production: { bg: '#9E9E9E', fg: '#FFF', label: 'P' },
  horses:     { bg: '#8B4513', fg: '#FFF', label: 'H' },
};

function drawResourceIcon(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, resource: string, zoom: number): void {
  if (zoom < 0.4) return;

  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY + TILE_HEIGHT / 2;
  const iconSize = zoom > 1 ? 16 : 12;

  // Try sprite icon first (food, gold, production have RPG icons)
  const spritePath = RESOURCE_SPRITES[resource];
  if (spritePath) {
    const img = spriteCache.getImage(spritePath);
    if (img) {
      // Subtle drop shadow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, iconSize * 0.5, iconSize * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      spriteCache.drawImage(ctx, spritePath,
        cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
      return;
    }
  }

  // Programmatic marker (used for horses and as fallback)
  const marker = RESOURCE_MARKER_COLORS[resource];
  if (!marker) return;
  const r = zoom > 1 ? 7 : 5;

  // Circle background
  ctx.fillStyle = marker.bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Letter label
  if (zoom >= 0.6) {
    ctx.fillStyle = marker.fg;
    ctx.font = `bold ${r}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(marker.label, cx, cy + 0.5);
  }
}

// ---------------------------------------------------------------------------
// Territory overlay with border edges
// ---------------------------------------------------------------------------

/**
 * Helper to convert hex color to rgba
 * @param hex - Hex color string (e.g., '#FF0000')
 * @param alpha - Alpha value 0-1
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get the owner of a neighboring tile
 * @param grid - The game grid
 * @param gridSize - Size of the grid
 * @param x - Current tile x
 * @param y - Current tile y
 * @param dx - Direction x offset
 * @param dy - Direction y offset
 * @returns The owner CivId or null if unowned/out of bounds
 */
function getNeighborOwner(
  grid: CivTile[][],
  gridSize: number,
  x: number,
  y: number,
  dx: number,
  dy: number
): CivId | null {
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) {
    return null;
  }
  return grid[ny]?.[nx]?.ownerId ?? null;
}

/**
 * Draw territory overlay with colored fill and border edges.
 * Borders are only drawn on edges where the neighbor has a different (or no) owner.
 */
function drawTerritoryOverlay(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  ownerId: CivId,
  grid: CivTile[][],
  gridSize: number,
  tileX: number,
  tileY: number,
): void {
  const corners = getDiamondCorners(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  const civColor = CIV_COLORS[ownerId] ?? { primary: '#888888', secondary: '#CCCCCC' };

  // Draw semi-transparent fill (15% opacity)
  ctx.fillStyle = hexToRgba(civColor.primary, 0.15);
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();

  // Check each neighbor and draw border edges where ownership differs
  // In isometric grid:
  // - North neighbor (x-1, y): edge from left to top
  // - East neighbor (x, y-1): edge from top to right
  // - South neighbor (x+1, y): edge from right to bottom
  // - West neighbor (x, y+1): edge from bottom to left

  const borderColor = hexToRgba(civColor.primary, 0.7);
  const borderWidth = 2.5;

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // North edge (x-1, y) - from left corner to top corner
  const northOwner = getNeighborOwner(grid, gridSize, tileX, tileY, -1, 0);
  if (northOwner !== ownerId) {
    ctx.beginPath();
    ctx.moveTo(corners.left.x, corners.left.y);
    ctx.lineTo(corners.top.x, corners.top.y);
    ctx.stroke();
  }

  // East edge (x, y-1) - from top corner to right corner
  const eastOwner = getNeighborOwner(grid, gridSize, tileX, tileY, 0, -1);
  if (eastOwner !== ownerId) {
    ctx.beginPath();
    ctx.moveTo(corners.top.x, corners.top.y);
    ctx.lineTo(corners.right.x, corners.right.y);
    ctx.stroke();
  }

  // South edge (x+1, y) - from right corner to bottom corner
  const southOwner = getNeighborOwner(grid, gridSize, tileX, tileY, 1, 0);
  if (southOwner !== ownerId) {
    ctx.beginPath();
    ctx.moveTo(corners.right.x, corners.right.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.stroke();
  }

  // West edge (x, y+1) - from bottom corner to left corner
  const westOwner = getNeighborOwner(grid, gridSize, tileX, tileY, 0, 1);
  if (westOwner !== ownerId) {
    ctx.beginPath();
    ctx.moveTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.left.x, corners.left.y);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Water depth system — coastal, medium, deep
// ---------------------------------------------------------------------------

/** Water depth colors: [top face, left face, right face] */
const WATER_DEPTH_COLORS = {
  coastal: { top: '#5BB8D4', left: '#4AA3BF', right: '#3D96B2', stroke: '#3689A5' },
  medium:  { top: '#3478A0', left: '#2B6788', right: '#235878', stroke: '#1C4A68' },
  deep:    { top: '#1B3A5C', left: '#15304D', right: '#102840', stroke: '#0C2035' },
};

/** Cached water depth map (grid coord key → depth 1/2/3) */
let _waterDepthCache: Map<string, number> | null = null;
let _waterDepthGridId: string | null = null;

/**
 * Compute water depth for every water tile via BFS from land.
 * Depth 1 = coastal (adjacent to non-water), 2 = medium, 3+ = deep.
 * Cached across frames; recomputed only if the grid changes.
 */
function getWaterDepthMap(grid: CivTile[][], gridSize: number): Map<string, number> {
  // Simple cache key: grid size + a few sampled tile types
  const cacheId = `${gridSize}`;
  if (_waterDepthCache && _waterDepthGridId === cacheId) return _waterDepthCache;

  const depthMap = new Map<string, number>();
  const queue: { x: number; y: number; depth: number }[] = [];

  // Seed BFS: all water tiles adjacent to non-water start at depth 1
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y]?.[x];
      if (!tile || tile.terrain !== 'water') continue;

      // Check 4 neighbors for non-water
      let isCoastal = false;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) {
          // Edge of map counts as coast
          isCoastal = true;
          break;
        }
        const neighbor = grid[ny]?.[nx];
        if (!neighbor || neighbor.terrain !== 'water') {
          isCoastal = true;
          break;
        }
      }

      if (isCoastal) {
        depthMap.set(`${x},${y}`, 1);
        queue.push({ x, y, depth: 1 });
      }
    }
  }

  // BFS outward to compute depth for remaining water tiles
  let head = 0;
  while (head < queue.length) {
    const { x, y, depth } = queue[head++];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
      if (depthMap.has(key)) continue;
      const neighbor = grid[ny]?.[nx];
      if (!neighbor || neighbor.terrain !== 'water') continue;
      depthMap.set(key, depth + 1);
      queue.push({ x: nx, y: ny, depth: depth + 1 });
    }
  }

  _waterDepthCache = depthMap;
  _waterDepthGridId = cacheId;
  return depthMap;
}

function getWaterColors(depth: number): typeof WATER_DEPTH_COLORS.coastal {
  if (depth <= 1) return WATER_DEPTH_COLORS.coastal;
  if (depth <= 2) return WATER_DEPTH_COLORS.medium;
  return WATER_DEPTH_COLORS.deep;
}

function drawWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  depth: number,
  time: number,
  gx: number, gy: number,
): void {
  // Use tileset water sprite as base so it sits at the same level as land
  const { region, tileset } = getTerrainVariant('water', gx, gy);
  const tilesetImg = spriteCache.getImage(tileset);

  const dx = screenX;
  const dy = screenY + TILE_HEIGHT / 2 - SPRITE_CELL / 2;

  if (tilesetImg) {
    spriteCache.drawSprite(ctx, tileset, region, dx, dy, SPRITE_CELL, SPRITE_CELL);
  }

  // Overlay depth-based tint on the diamond area
  const corners = getDiamondCorners(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  const tint = depth <= 1
    ? 'rgba(90, 190, 220, 0.35)'   // coastal — light turquoise
    : depth <= 2
    ? 'rgba(40, 100, 170, 0.45)'   // medium — blue
    : 'rgba(15, 30, 70, 0.55)';    // deep — dark navy

  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();

  // Animated wave shimmer
  const wave = Math.sin(time * 1.5 + gx * 0.7 + gy * 0.5) * 0.04;
  const shimmer = depth <= 1 ? 0.10 + wave : depth <= 2 ? 0.06 + wave : 0.03 + wave;

  ctx.fillStyle = `rgba(255, 255, 255, ${shimmer})`;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Barbarian Camp marker (skull/tent icon)
// ---------------------------------------------------------------------------

function drawBarbarianCampMarker(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, zoom: number): void {
  if (zoom < 0.3) return;

  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY + TILE_HEIGHT / 2;
  const size = zoom > 1 ? 24 : 18;

  // Draw tent/camp base
  ctx.save();

  // Dark shadow underneath
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, size * 0.6, size * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Tent body (triangular shape)
  ctx.fillStyle = '#4A3728'; // Dark brown tent
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.8);
  ctx.lineTo(cx + size * 0.7, cy + size * 0.3);
  ctx.lineTo(cx - size * 0.7, cy + size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2A1A10';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tent entrance (darker center)
  ctx.fillStyle = '#1A0A00';
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.1);
  ctx.lineTo(cx + size * 0.25, cy + size * 0.3);
  ctx.lineTo(cx - size * 0.25, cy + size * 0.3);
  ctx.closePath();
  ctx.fill();

  // Skull decoration on tent
  const skullSize = size * 0.35;
  const skullY = cy - size * 0.35;

  // Skull outline
  ctx.fillStyle = '#E0D8C8';
  ctx.beginPath();
  ctx.ellipse(cx, skullY, skullSize * 0.5, skullSize * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jaw
  ctx.beginPath();
  ctx.moveTo(cx - skullSize * 0.35, skullY + skullSize * 0.2);
  ctx.lineTo(cx - skullSize * 0.25, skullY + skullSize * 0.5);
  ctx.lineTo(cx + skullSize * 0.25, skullY + skullSize * 0.5);
  ctx.lineTo(cx + skullSize * 0.35, skullY + skullSize * 0.2);
  ctx.closePath();
  ctx.fill();

  // Eye sockets
  ctx.fillStyle = '#1A0A00';
  ctx.beginPath();
  ctx.ellipse(cx - skullSize * 0.2, skullY - skullSize * 0.05, skullSize * 0.12, skullSize * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + skullSize * 0.2, skullY - skullSize * 0.05, skullSize * 0.12, skullSize * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose hole
  ctx.beginPath();
  ctx.moveTo(cx, skullY + skullSize * 0.1);
  ctx.lineTo(cx - skullSize * 0.08, skullY + skullSize * 0.25);
  ctx.lineTo(cx + skullSize * 0.08, skullY + skullSize * 0.25);
  ctx.closePath();
  ctx.fill();

  // Red warning glow around camp
  const pulseOffset = (Date.now() % 3000) / 3000 * Math.PI * 2;
  const pulse = 0.3 + 0.15 * Math.sin(pulseOffset);
  ctx.globalAlpha = pulse;
  const gradient = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size * 1.2);
  gradient.addColorStop(0, 'rgba(139, 0, 0, 0.4)');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Natural Wonder marker (distinct visual indicator)
// ---------------------------------------------------------------------------

function drawNaturalWonderMarker(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, zoom: number): void {
  if (zoom < 0.3) return;

  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY + TILE_HEIGHT / 2;

  // Draw a golden star/sparkle effect to indicate natural wonder
  const size = zoom > 1 ? 20 : 14;
  const pulseOffset = (Date.now() % 2000) / 2000 * Math.PI * 2;
  const pulse = 0.8 + 0.2 * Math.sin(pulseOffset);

  // Outer glow
  ctx.save();
  ctx.globalAlpha = 0.4 * pulse;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.5);
  gradient.addColorStop(0, '#FFD700');
  gradient.addColorStop(0.5, '#FFA500');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Star shape
  ctx.save();
  ctx.fillStyle = '#FFD700';
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 1;

  const points = 6;
  const outerRadius = size * 0.5 * pulse;
  const innerRadius = outerRadius * 0.5;

  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Center sparkle
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main terrain renderer
// ---------------------------------------------------------------------------

export function renderTerrain(
  ctx: CanvasRenderingContext2D,
  grid: CivTile[][],
  gridSize: number,
  offset: { x: number; y: number },
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  // Pre-compute water depth map for coastal/medium/deep rendering
  const waterDepth = getWaterDepthMap(grid, gridSize);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y]?.[x];
      if (!tile) continue;

      const screen = gridToScreen(x, y);
      const height = getTerrainHeight(tile.terrain);

      // Water gets its own depth-based rendering
      if (tile.terrain === 'water') {
        const depth = waterDepth.get(`${x},${y}`) ?? 3;
        drawWaterTile(ctx, screen.x, screen.y, depth, time, x, y);
      } else if (hasTerrainSprite(tile.terrain)) {
        // Try sprite rendering for supported terrain types
        if (!drawTerrainSprite(ctx, screen.x, screen.y, tile.terrain, x, y)) {
          // Fallback to colored diamond if sprites not loaded yet
          const terrainColors = TERRAIN_COLORS[tile.terrain];
          drawDiamond(ctx, screen.x, screen.y, terrainColors, zoom >= 0.5, 0);
        }
      } else {
        // Remaining types — use colored diamonds with height/effects
        const terrainColors = TERRAIN_COLORS[tile.terrain];
        drawDiamond(ctx, screen.x, screen.y - height, terrainColors, zoom >= 0.5, height);
      }

      // Territory overlay
      if (tile.ownerId) {
        drawTerritoryOverlay(ctx, screen.x, screen.y - height, tile.ownerId, grid, gridSize, x, y);
      }

      // Improvement sprite (farm, mine, road)
      if (tile.improvement) {
        const impPath = IMPROVEMENT_SPRITES[tile.improvement];
        if (impPath && spriteCache.getImage(impPath)) {
          const impSize = 24;
          const impX = screen.x + TILE_WIDTH / 2 - impSize / 2;
          const impY = screen.y - height + TILE_HEIGHT / 2 - impSize / 2 - 4;
          spriteCache.drawImage(ctx, impPath, impX, impY, impSize, impSize);
        }
      }

      // Resource icon
      if (tile.resource) {
        drawResourceIcon(ctx, screen.x, screen.y - height, tile.resource, zoom);
      }

      // Natural wonder marker
      if (tile.naturalWonderId) {
        drawNaturalWonderMarker(ctx, screen.x, screen.y - height, zoom);
      }
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Fog of war
// ---------------------------------------------------------------------------

export function renderFogOfWar(
  ctx: CanvasRenderingContext2D,
  gridSize: number,
  knownTiles: Set<string>,
  offset: { x: number; y: number },
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const key = `${x},${y}`;
      if (knownTiles.has(key)) continue;

      const screen = gridToScreen(x, y);
      const corners = getDiamondCorners(screen.x, screen.y, TILE_WIDTH, TILE_HEIGHT);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.moveTo(corners.top.x, corners.top.y);
      ctx.lineTo(corners.right.x, corners.right.y);
      ctx.lineTo(corners.bottom.x, corners.bottom.y);
      ctx.lineTo(corners.left.x, corners.left.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Barbarian camps rendering
// ---------------------------------------------------------------------------

export function renderBarbarianCamps(
  ctx: CanvasRenderingContext2D,
  barbarianCamps: Record<string, BarbarianCamp>,
  offset: { x: number; y: number },
  zoom: number,
): void {
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  for (const camp of Object.values(barbarianCamps)) {
    const screen = gridToScreen(camp.x, camp.y);
    drawBarbarianCampMarker(ctx, screen.x, screen.y, zoom);
  }

  ctx.restore();
}

export { TILE_WIDTH, TILE_HEIGHT };
