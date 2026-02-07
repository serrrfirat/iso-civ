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

/** Whether a terrain type uses the tileset sprites (hills only — they need elevation) */
function hasTerrainSprite(terrain: TerrainType): boolean {
  return terrain === 'hills' || terrain === 'mountain';
}

// ---------------------------------------------------------------------------
// Programmatic terrain tiles (plains, forest, desert)
// ---------------------------------------------------------------------------

/** Color palettes for programmatic terrain diamonds with subtle variation */
const PLAINS_COLORS = [
  { top: '#6B9E3C', left: '#5A8A2F', right: '#7CB848', stroke: '#4A7A22' },
  { top: '#5F9335', left: '#508228', right: '#70AC40', stroke: '#437520' },
  { top: '#74A844', left: '#639234', right: '#85C050', stroke: '#538425' },
];

const DESERT_COLORS = [
  { top: '#D4B87A', left: '#C4A86A', right: '#E0C88A', stroke: '#B0985A' },
  { top: '#CCAE70', left: '#BC9E60', right: '#D8BE80', stroke: '#A89050' },
  { top: '#DAC084', left: '#CAB074', right: '#E6D094', stroke: '#B8A060' },
];

function drawProgrammaticTerrain(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  terrain: TerrainType,
  gx: number, gy: number,
): void {
  const corners = getDiamondCorners(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  // Deterministic variant based on tile position
  const hash = ((gx * 374761393 + gy * 668265263) >>> 0) % 3;

  if (terrain === 'desert') {
    const c = DESERT_COLORS[hash];
    ctx.fillStyle = c.top;
    ctx.beginPath();
    ctx.moveTo(corners.top.x, corners.top.y);
    ctx.lineTo(corners.right.x, corners.right.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.left.x, corners.left.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = 0.3;
    ctx.stroke();
  } else {
    // Plains and forest use green base
    const c = PLAINS_COLORS[hash];
    ctx.fillStyle = c.top;
    ctx.beginPath();
    ctx.moveTo(corners.top.x, corners.top.y);
    ctx.lineTo(corners.right.x, corners.right.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.left.x, corners.left.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = 0.3;
    ctx.stroke();
  }

  // Forest: overlay tree decoration on green base
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
}

/**
 * Draw a terrain tile using the sprite tileset (hills/mountain only).
 */
function drawTerrainSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  terrain: TerrainType,
  gx: number, gy: number,
): boolean {
  const baseTerrain = terrain === 'mountain' ? 'hills' : terrain;
  const { region, tileset } = getTerrainVariant(baseTerrain, gx, gy);

  const tilesetImg = spriteCache.getImage(tileset);
  if (!tilesetImg) return false;

  const dx = screenX;
  const dy = screenY + TILE_HEIGHT / 2 - SPRITE_CELL / 2;

  spriteCache.drawSprite(ctx, tileset, region, dx, dy, SPRITE_CELL, SPRITE_CELL);

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
// Resource icons (sprite-based with programmatic fallback)
// ---------------------------------------------------------------------------

/** Resource color scheme for programmatic fallback markers */
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
  const iconSize = zoom > 1 ? 28 : 22;

  // Try sprite icon first
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

  // Programmatic fallback
  const marker = RESOURCE_MARKER_COLORS[resource];
  if (!marker) return;
  const r = zoom > 1 ? 7 : 5;

  ctx.fillStyle = marker.bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

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
  const corners = getDiamondCorners(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);

  // Draw clean water diamond (no tileset sprite — they had ugly dark blobs)
  const colors = getWaterColors(depth);
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();

  // Subtle grid stroke for structure
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 0.3;
  ctx.stroke();

  // Animated wave shimmer
  const wave = Math.sin(time * 1.5 + gx * 0.7 + gy * 0.5) * 0.06;
  const shimmer = depth <= 1 ? 0.12 + wave : depth <= 2 ? 0.07 + wave : 0.03 + wave;

  ctx.fillStyle = `rgba(255, 255, 255, ${shimmer})`;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();

  // Secondary wave ripple for coastal tiles
  if (depth <= 1) {
    const ripple = Math.sin(time * 2.0 + gx * 1.3 + gy * 0.9) * 0.04;
    ctx.fillStyle = `rgba(200, 230, 255, ${0.08 + ripple})`;
    ctx.beginPath();
    ctx.moveTo(corners.top.x, corners.top.y);
    ctx.lineTo(corners.right.x, corners.right.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.left.x, corners.left.y);
    ctx.closePath();
    ctx.fill();
  }
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
// Programmatic improvement overlays (farm, mine, road)
// Drawn in isometric perspective to match the grid perfectly.
// ---------------------------------------------------------------------------

function drawFarmOverlay(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  height: number,
): void {
  const corners = getDiamondCorners(screenX, screenY - height, TILE_WIDTH, TILE_HEIGHT);

  // Golden wheat field base
  ctx.fillStyle = '#C8A84E';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Draw wheat rows following isometric lines
  const rows = 6;
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    // Interpolate along top→left and right→bottom edges (isometric diagonal)
    const startX = corners.top.x + (corners.left.x - corners.top.x) * t;
    const startY = corners.top.y + (corners.left.y - corners.top.y) * t;
    const endX = corners.right.x + (corners.bottom.x - corners.right.x) * t;
    const endY = corners.right.y + (corners.bottom.y - corners.right.y) * t;

    // Furrow line
    ctx.strokeStyle = '#A08040';
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Wheat stalks along each row
    const stalks = 5;
    for (let d = 1; d < stalks; d++) {
      const dt = d / stalks;
      const bx = startX + (endX - startX) * dt;
      const by = startY + (endY - startY) * dt;

      // Stalk
      ctx.strokeStyle = '#B8960A';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by - 4);
      ctx.stroke();

      // Wheat head (tiny golden oval)
      ctx.fillStyle = (d + i) % 2 === 0 ? '#DAA520' : '#C8A010';
      ctx.beginPath();
      ctx.ellipse(bx, by - 4.5, 1, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMineOverlay(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  height: number,
): void {
  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY - height + TILE_HEIGHT / 2;

  // Dark pit opening (isometric ellipse)
  ctx.fillStyle = '#2A1A0A';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stone rim around the pit
  ctx.strokeStyle = '#6B6B6B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 9, 5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Pickaxe icon above the pit
  ctx.strokeStyle = '#8B7355';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 8);
  ctx.lineTo(cx + 3, cy - 2);
  ctx.stroke();

  // Pickaxe head
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - 9);
  ctx.lineTo(cx - 3, cy - 7);
  ctx.stroke();

  // Small ore sparkle
  ctx.fillStyle = '#FFD700';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(cx + 5, cy - 4, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

function drawRoadOverlay(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  height: number,
): void {
  const corners = getDiamondCorners(screenX, screenY - height, TILE_WIDTH, TILE_HEIGHT);
  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY - height + TILE_HEIGHT / 2;

  // Draw a subtle path crossing the tile diagonally (NE-SW isometric direction)
  ctx.strokeStyle = '#9E8E6E';
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.quadraticCurveTo(cx + 1, cy, corners.bottom.x, corners.bottom.y);
  ctx.stroke();

  // Edge lines
  ctx.strokeStyle = '#7A6A4A';
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(corners.top.x - 2, corners.top.y + 1);
  ctx.quadraticCurveTo(cx - 1, cy + 1, corners.bottom.x - 2, corners.bottom.y + 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(corners.top.x + 2, corners.top.y - 1);
  ctx.quadraticCurveTo(cx + 3, cy - 1, corners.bottom.x + 2, corners.bottom.y - 1);
  ctx.stroke();

  ctx.globalAlpha = 1.0;
}

function drawImprovementOverlay(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  height: number,
  improvement: string,
): void {
  switch (improvement) {
    case 'farm': drawFarmOverlay(ctx, screenX, screenY, height); break;
    case 'mine': drawMineOverlay(ctx, screenX, screenY, height); break;
    case 'road': drawRoadOverlay(ctx, screenX, screenY, height); break;
  }
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
      } else if (tile.terrain === 'plains' || tile.terrain === 'forest' || tile.terrain === 'desert') {
        // Programmatic flat terrain (clean diamonds, no tileset grid artifacts)
        drawProgrammaticTerrain(ctx, screen.x, screen.y, tile.terrain, x, y);
      } else if (hasTerrainSprite(tile.terrain)) {
        // Hills/mountain use tileset sprites (they need elevation visuals)
        if (!drawTerrainSprite(ctx, screen.x, screen.y, tile.terrain, x, y)) {
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

      // Improvement (farm, mine, road) — sprite with programmatic fallback
      if (tile.improvement) {
        const impPath = IMPROVEMENT_SPRITES[tile.improvement];
        if (impPath && spriteCache.getImage(impPath)) {
          const impSize = 34;
          const impX = screen.x + TILE_WIDTH / 2 - impSize / 2;
          const impY = screen.y - height + TILE_HEIGHT / 2 - impSize / 2 - 6;
          spriteCache.drawImage(ctx, impPath, impX, impY, impSize, impSize);
        } else {
          drawImprovementOverlay(ctx, screen.x, screen.y, height, tile.improvement);
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
