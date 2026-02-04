import { CivTile, TERRAIN_COLORS, RESOURCE_COLORS, CivId, CIV_COLORS, TerrainType } from '@/games/civ/types';
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

/** Whether a terrain type has a usable sprite in the tileset */
function hasTerrainSprite(terrain: TerrainType): boolean {
  return terrain === 'plains' || terrain === 'forest' || terrain === 'desert'
    || terrain === 'water' || terrain === 'hills' || terrain === 'mountain';
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
// Territory overlay
// ---------------------------------------------------------------------------

function drawTerritoryOverlay(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  ownerId: CivId,
): void {
  const corners = getDiamondCorners(x, y, TILE_WIDTH, TILE_HEIGHT);
  const civColor = CIV_COLORS[ownerId];

  ctx.fillStyle = civColor.primary + '20';
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = civColor.primary + '50';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Water animation
// ---------------------------------------------------------------------------

export function drawWaterAnimation(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  time: number,
): void {
  const corners = getDiamondCorners(x, y, TILE_WIDTH, TILE_HEIGHT);
  const wave = Math.sin(time * 2 + x * 0.5 + y * 0.3) * 0.03;
  const alpha = 0.15 + wave;

  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(corners.top.x, corners.top.y);
  ctx.lineTo(corners.right.x, corners.right.y);
  ctx.lineTo(corners.bottom.x, corners.bottom.y);
  ctx.lineTo(corners.left.x, corners.left.y);
  ctx.closePath();
  ctx.fill();
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

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y]?.[x];
      if (!tile) continue;

      const screen = gridToScreen(x, y);
      const height = getTerrainHeight(tile.terrain);

      // Try sprite rendering for supported terrain types
      if (hasTerrainSprite(tile.terrain)) {
        if (!drawTerrainSprite(ctx, screen.x, screen.y, tile.terrain, x, y)) {
          // Fallback to colored diamond if sprites not loaded yet
          const terrainColors = TERRAIN_COLORS[tile.terrain];
          drawDiamond(ctx, screen.x, screen.y, terrainColors, zoom >= 0.5, 0);
        }
      } else {
        // Hills, mountains, water — use colored diamonds with height/effects
        const terrainColors = TERRAIN_COLORS[tile.terrain];
        drawDiamond(ctx, screen.x, screen.y - height, terrainColors, zoom >= 0.5, height);
      }

      // Territory overlay
      if (tile.ownerId) {
        drawTerritoryOverlay(ctx, screen.x, screen.y - height, tile.ownerId);
      }

      // Water shimmer
      if (tile.terrain === 'water') {
        drawWaterAnimation(ctx, screen.x, screen.y, time);
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

export { TILE_WIDTH, TILE_HEIGHT };
