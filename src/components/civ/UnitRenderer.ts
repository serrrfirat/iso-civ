import { Unit, City, CivId, CIV_COLORS, UnitAnimation } from '@/games/civ/types';
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from './TerrainRenderer';
import { spriteCache, CITY_SPRITE, UNIT_SPRITES } from '@/lib/civ/spriteLoader';

// ============================================================================
// Animation interpolation utilities
// ============================================================================

/** Easing function for smooth animation (ease-out cubic) */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Get interpolated screen position for a unit, accounting for animation state */
function getUnitScreenPosition(unit: Unit, currentTime: number): { x: number; y: number; isAnimating: boolean } {
  const anim = unit.animating;

  if (anim) {
    const elapsed = currentTime - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);

    if (progress >= 1) {
      // Animation complete - clear it and return final position
      unit.animating = undefined;
      return { ...gridToScreen(unit.x, unit.y), isAnimating: false };
    }

    // Interpolate between from and to positions in screen space
    const easedProgress = easeOutCubic(progress);
    const fromScreen = gridToScreen(anim.fromX, anim.fromY);
    const toScreen = gridToScreen(unit.x, unit.y);

    return {
      x: fromScreen.x + (toScreen.x - fromScreen.x) * easedProgress,
      y: fromScreen.y + (toScreen.y - fromScreen.y) * easedProgress,
      isAnimating: true,
    };
  }

  return { ...gridToScreen(unit.x, unit.y), isAnimating: false };
}

// ============================================================================
// Unit shape rendering — fallback geometric shapes when sprites not available
// ============================================================================

const UNIT_SHAPES: Record<string, (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => void> = {
  warrior: (ctx, cx, cy, size, color) => {
    // Shield shape
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size * 0.8, cy - size * 0.3);
    ctx.lineTo(cx + size * 0.8, cy + size * 0.3);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size * 0.8, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.8, cy - size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.lineTo(cx, cy + size * 0.5);
    ctx.moveTo(cx - size * 0.3, cy - size * 0.1);
    ctx.lineTo(cx + size * 0.3, cy - size * 0.1);
    ctx.stroke();
  },
  archer: (ctx, cx, cy, size, color) => {
    // Triangle (arrowhead)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size * 0.8, cy + size * 0.7);
    ctx.lineTo(cx - size * 0.8, cy + size * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.4);
    ctx.lineTo(cx, cy + size * 0.4);
    ctx.stroke();
  },
  scout: (ctx, cx, cy, size, color) => {
    // Diamond
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size * 0.7, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size * 0.7, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
  },
  settler: (ctx, cx, cy, size, color) => {
    // Circle with star
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },
};

/** Generic fallback shape for unit types without a specific shape */
function drawGenericUnit(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, label: string): void {
  // Pentagon shape
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const x = cx + size * 0.8 * Math.cos(angle);
    const y = cy + size * 0.8 * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // First letter of unit type
  ctx.fillStyle = '#FFF';
  ctx.font = `bold ${Math.round(size * 0.8)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label[0].toUpperCase(), cx, cy);
}

function drawHealthBar(ctx: CanvasRenderingContext2D, cx: number, cy: number, hp: number, maxHp: number, size: number): void {
  if (hp >= maxHp) return;
  const barWidth = size * 1.6;
  const barHeight = 3;
  const barY = cy + size + 2;
  const barX = cx - barWidth / 2;
  const ratio = hp / maxHp;

  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = ratio > 0.6 ? '#22C55E' : ratio > 0.3 ? '#EAB308' : '#EF4444';
  ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
}

export function renderUnits(
  ctx: CanvasRenderingContext2D,
  units: Record<string, Unit>,
  offset: { x: number; y: number },
  zoom: number,
  currentTime?: number,
): void {
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  const unitSize = 10;
  const spriteSize = 36;
  const now = currentTime ?? Date.now();

  for (const unit of Object.values(units)) {
    // Get interpolated screen position (handles animation)
    const screen = getUnitScreenPosition(unit, now);
    const cx = screen.x + TILE_WIDTH / 2;
    const cy = screen.y + TILE_HEIGHT / 2 - 4;

    const civColor = CIV_COLORS[unit.ownerId] ?? { primary: '#888', secondary: '#CCC' };

    // Try generated sprite
    const spritePath = UNIT_SPRITES[unit.type];
    const spriteImg = spritePath ? spriteCache.getImage(spritePath) : null;

    if (spriteImg) {
      const sw = spriteSize;
      const sh = spriteSize;
      const dx = cx - sw / 2;
      const dy = cy - sh + 6;

      spriteCache.drawImage(ctx, spritePath, dx, dy, sw, sh);

      // Colored ring at feet for civ identification
      ctx.strokeStyle = civColor.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 10, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 11, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Fallback to geometric shapes
      const drawFn = UNIT_SHAPES[unit.type];
      if (drawFn) {
        drawFn(ctx, cx, cy, unitSize, civColor.primary);
      } else {
        drawGenericUnit(ctx, cx, cy, unitSize, civColor.primary, unit.type);
      }
    }

    drawHealthBar(ctx, cx, cy, unit.hp, unit.maxHp, unitSize);
  }

  ctx.restore();
}

// ============================================================================
// City rendering — uses castle sprite with colored banner
// ============================================================================

export function renderCities(
  ctx: CanvasRenderingContext2D,
  cities: Record<string, City>,
  offset: { x: number; y: number },
  zoom: number,
): void {
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  for (const city of Object.values(cities)) {
    const screen = gridToScreen(city.x, city.y);
    const cx = screen.x + TILE_WIDTH / 2;
    const cy = screen.y + TILE_HEIGHT / 2;
    const civColor = CIV_COLORS[city.ownerId] ?? { primary: '#888', secondary: '#CCC' };

    // Try sprite castle, fall back to diamond
    const castleImg = spriteCache.getImage(CITY_SPRITE);
    if (castleImg) {
      const scale = 48 / 368;
      const sw = 368 * scale;
      const sh = 345 * scale;
      const dx = cx - sw / 2;
      const dy = cy - sh + 6;

      spriteCache.drawImage(ctx, CITY_SPRITE, dx, dy, sw, sh);

      ctx.globalAlpha = 0.15;
      ctx.fillStyle = civColor.primary;
      ctx.fillRect(dx, dy, sw, sh);
      ctx.globalAlpha = 1.0;
    } else {
      const citySize = 14;
      ctx.fillStyle = civColor.primary;
      ctx.beginPath();
      ctx.moveTo(cx, cy - citySize);
      ctx.lineTo(cx + citySize, cy);
      ctx.lineTo(cx, cy + citySize);
      ctx.lineTo(cx - citySize, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const innerSize = citySize * 0.6;
      ctx.fillStyle = civColor.secondary;
      ctx.beginPath();
      ctx.moveTo(cx, cy - innerSize);
      ctx.lineTo(cx + innerSize, cy);
      ctx.lineTo(cx, cy + innerSize);
      ctx.lineTo(cx - innerSize, cy);
      ctx.closePath();
      ctx.fill();
    }

    // Civ color banner
    ctx.fillStyle = civColor.primary;
    ctx.fillRect(cx - 3, cy - 24, 6, 10);
    ctx.fillStyle = civColor.secondary;
    ctx.fillRect(cx - 2, cy - 23, 4, 3);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 24);
    ctx.lineTo(cx - 3, cy - 14);
    ctx.stroke();

    // Walls indicator
    if (city.buildings.includes('walls')) {
      ctx.strokeStyle = civColor.primary + 'AA';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // City name label
    if (zoom >= 0.5) {
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#000';
      ctx.fillText(city.name, cx + 1, cy - 26);
      ctx.fillStyle = '#FFF';
      ctx.fillText(city.name, cx, cy - 27);

      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`pop ${city.population}`, cx, cy + 16);
    }

    // Defense bar
    if (city.defense < 20 && zoom >= 0.7) {
      const barWidth = 20;
      const barHeight = 3;
      const barX = cx - barWidth / 2;
      const barY = cy + 20;
      const ratio = city.defense / 20;

      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = '#60A5FA';
      ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
  }

  ctx.restore();
}
