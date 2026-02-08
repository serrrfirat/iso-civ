// ============================================================================
// Sprite Loading & Caching for Civilization Game
// ============================================================================
// Handles loading terrain tileset spritesheets and individual building PNGs,
// with a singleton cache to avoid redundant network requests.
// Sprite paths are auto-derived from the ruleset for new units and buildings.
// ============================================================================

import type { TerrainType } from '@/games/civ/types';
import { ruleset } from './ruleset';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A rectangular region within a spritesheet */
export interface SpriteRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cell size in the terrain tileset spritesheet */
const TILE_W = 64;
const TILE_H = 64;

/** Path to the isometric terrain tileset (640x1024, 10 columns x 16 rows) */
export const TERRAIN_TILESET_PATH = '/sprites/terrain/iso-64x64-outside.png';

/** Path to the desert terrain tileset (1024x512, 16 columns x 8 rows, 64x64 cells) */
export const DESERT_TILESET_PATH = '/sprites/terrain/desert1.png';

/**
 * Terrain sprite regions from the MAIN tileset (iso-64x64-outside.png).
 * Desert uses a SEPARATE tileset (desert1.png) — see DESERT_SPRITES below.
 */
export const TERRAIN_SPRITES: Record<string, SpriteRegion[]> = {
  plains: [
    { x: 0 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 1 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 2 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
  ],
  forest: [
    { x: 5 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 6 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 7 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
  ],
  hills: [
    { x: 0 * TILE_W, y: 3 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 1 * TILE_W, y: 3 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 2 * TILE_W, y: 3 * TILE_H, w: TILE_W, h: TILE_H },
  ],
  mountain: [
    { x: 0 * TILE_W, y: 6 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 1 * TILE_W, y: 6 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 2 * TILE_W, y: 6 * TILE_H, w: TILE_W, h: TILE_H },
  ],
  water: [
    { x: 0 * TILE_W, y: 10 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 1 * TILE_W, y: 10 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 2 * TILE_W, y: 10 * TILE_H, w: TILE_W, h: TILE_H },
  ],
  // Desert placeholder — actual rendering uses DESERT_SPRITES from desert1.png
  desert: [
    { x: 0 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
  ],
};

/**
 * Desert-specific sprite regions from desert1.png (1024x512, 64x64 cells).
 */
export const DESERT_SPRITES: SpriteRegion[] = [
  { x: 0 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
  { x: 1 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
  { x: 2 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
  { x: 3 * TILE_W, y: 0 * TILE_H, w: TILE_W, h: TILE_H },
];

/**
 * Building sprite paths — legacy manually-assigned sprites for existing buildings.
 * New buildings from ruleset get auto-generated paths at /sprites/generated/{id}.png.
 */
const LEGACY_BUILDING_SPRITES: Record<string, string> = {
  granary:   '/sprites/buildings/citysim/house.png',
  walls:     '/sprites/buildings/citysim/watchtower.png',
  library:   '/sprites/buildings/citysim/chapel.png',
  market:    '/sprites/buildings/citysim/tavern.png',
  barracks:  '/sprites/buildings/citysim/inn.png',
};

/** Auto-generate building sprite paths from ruleset */
export const BUILDING_SPRITES: Record<string, string> = (() => {
  const sprites: Record<string, string> = { ...LEGACY_BUILDING_SPRITES };
  // Add generated paths for all buildings not in legacy map
  for (const id of Object.keys(ruleset.buildings)) {
    if (!sprites[id]) {
      sprites[id] = `/sprites/generated/${id}.png`;
    }
  }
  // Extra sprites for decoration
  sprites.thatched = '/sprites/buildings/citysim/thatched.png';
  sprites.farm = '/sprites/buildings/citysim/crops.png';
  sprites.firtree = '/sprites/buildings/citysim/firtree.png';
  sprites.oaktree = '/sprites/buildings/citysim/oaktree.png';
  return sprites;
})();

/** City sprite — the castle image used to represent cities on the map */
export const CITY_SPRITE = '/sprites/buildings/citysim/castle.png';

/** Resource icon paths — small icons drawn on top of terrain */
export const RESOURCE_SPRITES: Record<string, string> = {
  food:       '/sprites/generated/food_tile.png',
  gold:       '/sprites/generated/gold_tile.png',
  production: '/sprites/generated/production_tile.png',
  horses:     '/sprites/generated/horses_tile.png',
  iron:       '/sprites/generated/iron.png',
};

/** Improvement sprite paths (AI-generated) */
export const IMPROVEMENT_SPRITES: Record<string, string> = {
  farm: '/sprites/generated/farm.png',
  mine: '/sprites/generated/mine.png',
  road: '/sprites/generated/road.png',
};

/** Mountain decoration sprite (AI-generated, rendered on top of terrain) */
export const MOUNTAIN_SPRITE = '/sprites/generated/mountain.png';

/** Unit sprite paths — auto-derived from ruleset + generated convention */
export const UNIT_SPRITES: Record<string, string> = (() => {
  const sprites: Record<string, string> = {};
  for (const id of Object.keys(ruleset.units)) {
    sprites[id] = `/sprites/generated/${id}.png`;
  }
  return sprites;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic hash of a grid position to pick a consistent terrain variant.
 */
function tileHash(gx: number, gy: number): number {
  let h = (gx * 374761393 + gy * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return h >>> 0;
}

/**
 * Pick a terrain sprite variant deterministically based on grid position.
 */
export function getTerrainVariant(
  terrain: TerrainType,
  gx: number,
  gy: number,
): { region: SpriteRegion; tileset: string } {
  if (terrain === 'desert') {
    const index = tileHash(gx, gy) % DESERT_SPRITES.length;
    return { region: DESERT_SPRITES[index], tileset: DESERT_TILESET_PATH };
  }
  const variants = TERRAIN_SPRITES[terrain];
  if (!variants || variants.length === 0) {
    // Fallback to plains
    const fallback = TERRAIN_SPRITES['plains'];
    const index = tileHash(gx, gy) % fallback.length;
    return { region: fallback[index], tileset: TERRAIN_TILESET_PATH };
  }
  const index = tileHash(gx, gy) % variants.length;
  return { region: variants[index], tileset: TERRAIN_TILESET_PATH };
}

// ---------------------------------------------------------------------------
// Background removal for AI-generated sprites (RGB with no alpha channel)
// ---------------------------------------------------------------------------

/** All AI-generated sprites that need background removal */
const SPRITES_NEEDING_BG_REMOVAL = new Set([
  ...Object.values(UNIT_SPRITES),
  ...Object.values(IMPROVEMENT_SPRITES),
  MOUNTAIN_SPRITE,
  '/sprites/generated/horses.png',
  '/sprites/generated/horses_tile.png',
  '/sprites/generated/farm.png',
  '/sprites/generated/food_tile.png',
  '/sprites/generated/goldmine.png',
  '/sprites/generated/gold_tile.png',
  '/sprites/generated/iron.png',
  '/sprites/generated/production_tile.png',
  // Also include generated building sprites
  ...Object.entries(BUILDING_SPRITES)
    .filter(([, path]) => path.startsWith('/sprites/generated/'))
    .map(([, path]) => path),
]);

/** Sprites with common AI-generated red fringe artifacts */
const SPRITES_NEEDING_RED_FRINGE_CLEANUP = new Set([
  '/sprites/generated/horses.png',
  '/sprites/generated/horses_tile.png',
  '/sprites/generated/farm.png',
  '/sprites/generated/food_tile.png',
  '/sprites/generated/goldmine.png',
  '/sprites/generated/gold_tile.png',
  '/sprites/generated/iron.png',
  '/sprites/generated/production_tile.png',
]);

/**
 * Remove the checkered/white background from an AI-generated sprite.
 */
function removeBackground(img: HTMLImageElement): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return img;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const isLight = r > 190 && g > 190 && b > 190;
    const isGrayish = Math.abs(r - g) < 15 && Math.abs(g - b) < 15;

    if (isLight && isGrayish) {
      data[i + 3] = 0; // fully transparent
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const result = new Image();
  result.src = canvas.toDataURL('image/png');
  return result;
}

/**
 * Removes the hard red contour often present on AI-generated transparent assets.
 */
function removeRedFringe(img: HTMLImageElement): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return img;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Remove saturated red outline while preserving warm/orange shading.
    const redDominant = r > 150 && r - Math.max(g, b) > 70;
    const lowGreenBlue = g < 120 && b < 120;
    if (redDominant && lowGreenBlue) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const result = new Image();
  result.src = canvas.toDataURL('image/png');
  return result;
}

// ---------------------------------------------------------------------------
// SpriteCache — singleton image loader and drawing helper
// ---------------------------------------------------------------------------

class SpriteCache {
  /** Fully loaded and ready-to-draw images */
  private images: Map<string, HTMLImageElement> = new Map();

  /** In-flight load promises (de-duped) */
  private loading: Map<string, Promise<HTMLImageElement>> = new Map();

  async loadImage(src: string): Promise<HTMLImageElement> {
    const cached = this.images.get(src);
    if (cached) return cached;

    const inflight = this.loading.get(src);
    if (inflight) return inflight;

    const needsBgRemoval = SPRITES_NEEDING_BG_REMOVAL.has(src);
    const needsFringeCleanup = SPRITES_NEEDING_RED_FRINGE_CLEANUP.has(src);

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let final = needsBgRemoval ? removeBackground(img) : img;
        if (needsFringeCleanup) {
          final = removeRedFringe(final);
        }
        this.images.set(src, final);
        this.loading.delete(src);
        resolve(final);
      };
      img.onerror = (_event) => {
        this.loading.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };
      img.src = src;
    });

    this.loading.set(src, promise);
    return promise;
  }

  getImage(src: string): HTMLImageElement | null {
    return this.images.get(src) ?? null;
  }

  async preloadAll(): Promise<void> {
    const paths: string[] = [
      TERRAIN_TILESET_PATH,
      DESERT_TILESET_PATH,
      CITY_SPRITE,
      MOUNTAIN_SPRITE,
      ...Object.values(BUILDING_SPRITES),
      ...Object.values(RESOURCE_SPRITES),
      ...Object.values(IMPROVEMENT_SPRITES),
      ...Object.values(UNIT_SPRITES),
    ];

    // Deduplicate paths
    const uniquePaths = [...new Set(paths)];

    const results = await Promise.allSettled(uniquePaths.map((p) => this.loadImage(p)));

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.warn(`[SpriteCache] preload failed for ${uniquePaths[i]}:`, result.reason);
      }
    });
  }

  drawSprite(
    ctx: CanvasRenderingContext2D,
    src: string,
    region: SpriteRegion,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    const img = this.images.get(src);
    if (!img) return;

    ctx.drawImage(
      img,
      region.x, region.y, region.w, region.h,
      dx, dy, dw, dh,
    );
  }

  drawImage(
    ctx: CanvasRenderingContext2D,
    src: string,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    const img = this.images.get(src);
    if (!img) return;

    ctx.drawImage(img, dx, dy, dw, dh);
  }
}

/** Singleton sprite cache instance for the entire application */
export const spriteCache = new SpriteCache();
