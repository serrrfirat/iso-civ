// ============================================================================
// Sprite Loading & Caching for Civilization Game
// ============================================================================
// Handles loading terrain tileset spritesheets and individual building PNGs,
// with a singleton cache to avoid redundant network requests.
// ============================================================================

import type { TerrainType } from '@/games/civ/types';

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

/**
 * Terrain sprite regions — each TerrainType maps to 2-3 variant tile regions
 * from the iso-64x64-outside.png spritesheet so we get visual variety.
 *
 * The tileset is 10 columns wide (640 / 64) with 64x64 cells.
 *
 * Row/column assignments based on examining the tileset:
 *   plains  — Row 0  (y=0):   grass tiles, cols 0, 1, 2
 *   hills   — Row 4  (y=256): hilly terrain, cols 0, 1, 2
 *   mountain— Row 6  (y=384): rocky mountains, cols 0, 1, 2
 *   water   — Row 10 (y=640): water tiles, cols 0, 1, 2
 *   desert  — Row 3  (y=192): grass with brown edges (closest match), cols 0, 1, 2
 *   forest  — Row 0  (y=0):   grass base with tree-adjacent cols 5, 6, 7
 */
export const TERRAIN_SPRITES: Record<TerrainType, SpriteRegion[]> = {
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
    { x: 0 * TILE_W, y: 4 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 1 * TILE_W, y: 4 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 2 * TILE_W, y: 4 * TILE_H, w: TILE_W, h: TILE_H },
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
  desert: [
    { x: 0 * TILE_W, y: 3 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 1 * TILE_W, y: 3 * TILE_H, w: TILE_W, h: TILE_H },
    { x: 2 * TILE_W, y: 3 * TILE_H, w: TILE_W, h: TILE_H },
  ],
};

/**
 * Building sprite paths — individual PNGs keyed by BuildingType (plus extras).
 * All paths are relative to public/.
 */
export const BUILDING_SPRITES: Record<string, string> = {
  granary:   '/sprites/buildings/citysim/house.png',
  walls:     '/sprites/buildings/citysim/watchtower.png',
  library:   '/sprites/buildings/citysim/chapel.png',
  market:    '/sprites/buildings/citysim/tavern.png',
  barracks:  '/sprites/buildings/citysim/inn.png',
  thatched:  '/sprites/buildings/citysim/thatched.png',
  farm:      '/sprites/buildings/citysim/crops.png',
  firtree:   '/sprites/buildings/citysim/firtree.png',
  oaktree:   '/sprites/buildings/citysim/oaktree.png',
};

/** City sprite — the castle image used to represent cities on the map */
export const CITY_SPRITE = '/sprites/buildings/citysim/castle.png';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic hash of a grid position to pick a consistent terrain variant.
 * Uses a simple bit-mixing approach so the same (gx, gy) always returns the
 * same index, producing stable visuals across frames without randomness.
 */
function tileHash(gx: number, gy: number): number {
  let h = (gx * 374761393 + gy * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  // Ensure non-negative
  return h >>> 0;
}

/**
 * Pick a terrain sprite variant deterministically based on grid position.
 * Returns the same SpriteRegion for a given (terrain, gx, gy) every time.
 */
export function getTerrainVariant(
  terrain: TerrainType,
  gx: number,
  gy: number,
): SpriteRegion {
  const variants = TERRAIN_SPRITES[terrain];
  const index = tileHash(gx, gy) % variants.length;
  return variants[index];
}

// ---------------------------------------------------------------------------
// SpriteCache — singleton image loader and drawing helper
// ---------------------------------------------------------------------------

class SpriteCache {
  /** Fully loaded and ready-to-draw images */
  private images: Map<string, HTMLImageElement> = new Map();

  /** In-flight load promises (de-duped) */
  private loading: Map<string, Promise<HTMLImageElement>> = new Map();

  /**
   * Load an image by its src path. Returns a cached image immediately if
   * already loaded, otherwise kicks off a load and returns a promise.
   * Concurrent calls for the same src share one in-flight request.
   */
  async loadImage(src: string): Promise<HTMLImageElement> {
    // Already loaded — return immediately
    const cached = this.images.get(src);
    if (cached) return cached;

    // Already loading — return the existing promise
    const inflight = this.loading.get(src);
    if (inflight) return inflight;

    // Start a new load
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(src, img);
        this.loading.delete(src);
        resolve(img);
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

  /**
   * Synchronously retrieve a loaded image. Returns null if the image is not
   * yet loaded — callers should gracefully skip drawing in that case.
   */
  getImage(src: string): HTMLImageElement | null {
    return this.images.get(src) ?? null;
  }

  /**
   * Preload every game sprite (terrain tileset + all building PNGs + city).
   * Call this once during game initialization and await the result before
   * the first render frame for a seamless experience.
   */
  async preloadAll(): Promise<void> {
    const paths: string[] = [
      TERRAIN_TILESET_PATH,
      CITY_SPRITE,
      ...Object.values(BUILDING_SPRITES),
    ];

    const results = await Promise.allSettled(paths.map((p) => this.loadImage(p)));

    // Log any failures so they're visible during development
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.warn(`[SpriteCache] preload failed for ${paths[i]}:`, result.reason);
      }
    });
  }

  /**
   * Draw a rectangular region from a spritesheet onto the canvas.
   * Silently skips drawing if the source image hasn't loaded yet.
   *
   * @param ctx   - Canvas 2D rendering context
   * @param src   - Path to the spritesheet image
   * @param region - Source rectangle within the spritesheet
   * @param dx    - Destination x on the canvas
   * @param dy    - Destination y on the canvas
   * @param dw    - Destination width (stretch/shrink)
   * @param dh    - Destination height (stretch/shrink)
   */
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
    if (!img) return; // Not loaded yet — skip silently

    ctx.drawImage(
      img,
      region.x, region.y, region.w, region.h,
      dx, dy, dw, dh,
    );
  }

  /**
   * Draw a full image (not a spritesheet region) onto the canvas.
   * Useful for individual building PNGs. Silently skips if not loaded.
   *
   * @param ctx - Canvas 2D rendering context
   * @param src - Path to the image
   * @param dx  - Destination x on the canvas
   * @param dy  - Destination y on the canvas
   * @param dw  - Destination width
   * @param dh  - Destination height
   */
  drawImage(
    ctx: CanvasRenderingContext2D,
    src: string,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    const img = this.images.get(src);
    if (!img) return; // Not loaded yet — skip silently

    ctx.drawImage(img, dx, dy, dw, dh);
  }
}

/** Singleton sprite cache instance for the entire application */
export const spriteCache = new SpriteCache();
