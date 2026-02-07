import { Unit, City, CivId, CIV_COLORS, UnitAnimation } from '@/games/civ/types';
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from './TerrainRenderer';
import { spriteCache, CITY_SPRITE, UNIT_SPRITES } from '@/lib/civ/spriteLoader';

// ============================================================================
// Unit selection/hover state (managed by CivCanvas)
// ============================================================================

let selectedUnitId: string | null = null;
let hoveredUnitId: string | null = null;

export function setSelectedUnit(unitId: string | null): void {
  selectedUnitId = unitId;
}

export function setHoveredUnit(unitId: string | null): void {
  hoveredUnitId = unitId;
}

export function getHoveredUnit(): string | null {
  return hoveredUnitId;
}

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

/** Draw an isometric figure (person silhouette) viewed from SW direction */
function drawIsoPerson(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, bodyColor: string, accentColor: string,
): void {
  // Shadow on ground (isometric ellipse)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.1, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (oval torso, isometric lean)
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.25, s * 0.35, s * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Head
  ctx.fillStyle = '#E8C89E';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.85, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Accent detail on torso (belt/sash)
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.1);
  ctx.stroke();
}

const UNIT_SHAPES: Record<string, (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => void> = {
  warrior: (ctx, cx, cy, size, color) => {
    const s = size * 1.3;
    drawIsoPerson(ctx, cx, cy, s, color, '#8B7355');

    // Sword (angled right, held in front)
    ctx.strokeStyle = '#B0B0B0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.25, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.55, cy - s * 1.0);
    ctx.stroke();
    // Hilt
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.15, cy - s * 0.35);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.35);
    ctx.stroke();

    // Shield (left side)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.35, cy - s * 0.2, s * 0.2, s * 0.3, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  },
  swordsman: (ctx, cx, cy, size, color) => {
    const s = size * 1.3;
    drawIsoPerson(ctx, cx, cy, s, color, '#666');

    // Longer sword
    ctx.strokeStyle = '#C0C0C0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.2, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.6, cy - s * 1.1);
    ctx.stroke();
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.1, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.3);
    ctx.stroke();

    // Larger shield
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy - s * 0.5);
    ctx.lineTo(cx - s * 0.15, cy - s * 0.4);
    ctx.lineTo(cx - s * 0.15, cy + s * 0.1);
    ctx.lineTo(cx - s * 0.35, cy + s * 0.2);
    ctx.lineTo(cx - s * 0.5, cy + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  },
  archer: (ctx, cx, cy, size, color) => {
    const s = size * 1.3;
    drawIsoPerson(ctx, cx, cy, s, color, '#4A6B2F');

    // Bow (curved arc on right side)
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + s * 0.35, cy - s * 0.35, s * 0.55, -Math.PI * 0.7, Math.PI * 0.15);
    ctx.stroke();

    // Bowstring
    ctx.strokeStyle = '#CCC';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    const bowTopX = cx + s * 0.35 + s * 0.55 * Math.cos(-Math.PI * 0.7);
    const bowTopY = cy - s * 0.35 + s * 0.55 * Math.sin(-Math.PI * 0.7);
    const bowBotX = cx + s * 0.35 + s * 0.55 * Math.cos(Math.PI * 0.15);
    const bowBotY = cy - s * 0.35 + s * 0.55 * Math.sin(Math.PI * 0.15);
    ctx.moveTo(bowTopX, bowTopY);
    ctx.lineTo(bowBotX, bowBotY);
    ctx.stroke();

    // Quiver on back
    ctx.fillStyle = '#6B4E2E';
    ctx.fillRect(cx - s * 0.45, cy - s * 0.7, s * 0.12, s * 0.5);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - s * 0.45, cy - s * 0.7, s * 0.12, s * 0.5);
  },
  scout: (ctx, cx, cy, size, color) => {
    const s = size * 1.2;
    drawIsoPerson(ctx, cx, cy, s, color, '#556B2F');

    // Spyglass / staff (diagonal)
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.15, cy + s * 0.1);
    ctx.lineTo(cx + s * 0.5, cy - s * 0.7);
    ctx.stroke();

    // Hood/cloak detail
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.25, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.25, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.15, cy - s * 0.3);
    ctx.lineTo(cx - s * 0.15, cy - s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
  },
  settler: (ctx, cx, cy, size, color) => {
    const s = size * 1.3;
    // Cart/wagon base (isometric rectangle)
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.15);
    ctx.lineTo(cx + s * 0.5, cy);
    ctx.lineTo(cx, cy + s * 0.15);
    ctx.lineTo(cx - s * 0.5, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Covered wagon top (white canvas)
    ctx.fillStyle = '#F5F0E0';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.35, cy - s * 0.15);
    ctx.quadraticCurveTo(cx, cy - s * 0.65, cx + s * 0.35, cy - s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#AAA';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Civ color flag on wagon
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.6);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.5);
    ctx.lineTo(cx, cy - s * 0.4);
    ctx.closePath();
    ctx.fill();
    // Pole
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.6);
    ctx.lineTo(cx, cy - s * 0.15);
    ctx.stroke();

    // Wheels (isometric circles)
    ctx.strokeStyle = '#5A4020';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.3, cy + s * 0.05, s * 0.08, s * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.3, cy + s * 0.05, s * 0.08, s * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  worker: (ctx, cx, cy, size, color) => {
    const s = size * 1.2;
    drawIsoPerson(ctx, cx, cy, s, '#B8860B', color);

    // Pickaxe/tool
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.15, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.45, cy - s * 0.55);
    ctx.stroke();
    // Head of tool
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.35, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.45);
    ctx.stroke();
  },
  horseman: (ctx, cx, cy, size, color) => {
    const s = size * 1.3;
    // Horse body (isometric oval)
    ctx.fillStyle = '#8B6C42';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.55, s * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Horse legs (4 short lines)
    ctx.strokeStyle = '#6B4C22';
    ctx.lineWidth = 1.5;
    for (const lx of [-0.3, -0.1, 0.15, 0.35]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * lx, cy + s * 0.2);
      ctx.lineTo(cx + s * lx, cy + s * 0.45);
      ctx.stroke();
    }

    // Horse head
    ctx.fillStyle = '#7B5C32';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.5, cy - s * 0.15, s * 0.12, s * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Rider (small person on top)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.35, s * 0.18, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Rider head
    ctx.fillStyle = '#E8C89E';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.65, s * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Spear
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.1, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.25, cy - s * 1.0);
    ctx.stroke();
  },
  catapult: (ctx, cx, cy, size, color) => {
    const s = size * 1.3;
    // Base platform (isometric diamond)
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.15);
    ctx.lineTo(cx + s * 0.45, cy);
    ctx.lineTo(cx, cy + s * 0.15);
    ctx.lineTo(cx - s * 0.45, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Arm (angled upward)
    ctx.strokeStyle = '#6B4E2E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.1, cy);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.8);
    ctx.stroke();

    // Sling/bucket at end
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(cx + s * 0.3, cy - s * 0.8, s * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.strokeStyle = '#5A4020';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.3, cy + s * 0.08, s * 0.07, s * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.3, cy + s * 0.08, s * 0.07, s * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Civ color marking
    ctx.fillStyle = color;
    ctx.fillRect(cx - s * 0.15, cy - s * 0.05, s * 0.3, s * 0.08);
  },
};

/** Generic fallback shape for unit types without a specific shape */
function drawGenericUnit(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, label: string): void {
  const s = size * 1.3;
  drawIsoPerson(ctx, cx, cy, s, color, '#888');

  // Label on torso
  ctx.fillStyle = '#FFF';
  ctx.font = `bold ${Math.round(s * 0.45)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label[0].toUpperCase(), cx, cy - s * 0.25);
}

// ============================================================================
// Civ 6 Style Unit Banner Components
// ============================================================================

/** Draw Civ 6 style health bar with rounded ends positioned below unit */
function drawHealthBar(ctx: CanvasRenderingContext2D, cx: number, cy: number, hp: number, maxHp: number, barWidth: number = 24): void {
  const barHeight = 3;
  const barY = cy + 12; // Position below unit
  const barX = cx - barWidth / 2;
  const ratio = hp / maxHp;
  const borderRadius = barHeight / 2;

  // Background (dark gray with slight transparency)
  ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
  ctx.beginPath();
  ctx.roundRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2, borderRadius + 1);
  ctx.fill();

  // Empty bar background
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius);
  ctx.fill();

  // Health fill with color based on HP percentage
  // Green > 66%, Yellow 33-66%, Red < 33%
  let healthColor: string;
  if (ratio > 0.66) {
    healthColor = '#22C55E'; // Green
  } else if (ratio > 0.33) {
    healthColor = '#EAB308'; // Yellow
  } else {
    healthColor = '#EF4444'; // Red
  }

  if (ratio > 0) {
    const fillWidth = Math.max(barHeight, barWidth * ratio); // Ensure minimum width for rounded end
    ctx.fillStyle = healthColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillWidth, barHeight, borderRadius);
    ctx.fill();

    // Slight gradient/shine on health bar
    const gradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillWidth, barHeight, borderRadius);
    ctx.fill();
  }
}

/** Draw civ color banner/flag above unit - small triangle flag */
function drawCivBanner(ctx: CanvasRenderingContext2D, cx: number, cy: number, primary: string, secondary: string): void {
  const flagX = cx;
  const flagY = cy - 20; // Position above unit
  const flagWidth = 8;
  const flagHeight = 10;
  const poleHeight = 14;

  // Flag pole (thin line)
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(flagX, flagY + flagHeight);
  ctx.lineTo(flagX, flagY + flagHeight + poleHeight);
  ctx.stroke();

  // Flag triangle (pointing right)
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(flagX, flagY);
  ctx.lineTo(flagX + flagWidth, flagY + flagHeight / 2);
  ctx.lineTo(flagX, flagY + flagHeight);
  ctx.closePath();
  ctx.fill();

  // Flag border
  ctx.strokeStyle = secondary;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Small accent stripe
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(flagX, flagY + 2);
  ctx.lineTo(flagX + flagWidth * 0.6, flagY + flagHeight / 2);
  ctx.lineTo(flagX, flagY + flagHeight - 2);
  ctx.closePath();
  ctx.fill();
}

/** Draw movement pips (small dots) showing remaining movement points */
function drawMovementPips(ctx: CanvasRenderingContext2D, cx: number, cy: number, movement: number, movementLeft: number): void {
  if (movement <= 0) return;

  const pipRadius = 2;
  const pipSpacing = 6;
  const totalWidth = (movement - 1) * pipSpacing;
  const startX = cx - totalWidth / 2;
  const pipY = cy + 18; // Below health bar

  for (let i = 0; i < movement; i++) {
    const pipX = startX + i * pipSpacing;
    const hasMoves = i < movementLeft;

    // Pip background/shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(pipX, pipY + 0.5, pipRadius + 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Pip fill
    ctx.fillStyle = hasMoves ? '#FFFFFF' : '#4a4a4a';
    ctx.beginPath();
    ctx.arc(pipX, pipY, pipRadius, 0, Math.PI * 2);
    ctx.fill();

    // Slight highlight on filled pips
    if (hasMoves) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(pipX - 0.5, pipY - 0.5, pipRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draw selection/hover glow effect around unit */
function drawSelectionGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, isSelected: boolean, isHovered: boolean, time: number): void {
  if (!isSelected && !isHovered) return;

  const baseRadius = 16;
  const pulseAmount = isSelected ? 3 : 1.5;
  const pulseSpeed = isSelected ? 0.003 : 0.002;
  const pulse = Math.sin(time * pulseSpeed) * pulseAmount;
  const radius = baseRadius + pulse;

  // Outer glow (multiple layers for softer effect)
  const glowLayers = isSelected ? 4 : 2;
  const baseAlpha = isSelected ? 0.4 : 0.25;
  const glowColor = isSelected ? '255, 215, 0' : '255, 255, 255'; // Gold for selected, white for hover

  for (let i = glowLayers; i >= 1; i--) {
    const layerRadius = radius + i * 3;
    const alpha = baseAlpha * (1 - i / (glowLayers + 1));

    ctx.strokeStyle = `rgba(${glowColor}, ${alpha})`;
    ctx.lineWidth = 2 + i;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, layerRadius, layerRadius * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Inner bright ring
  ctx.strokeStyle = isSelected ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = isSelected ? 2 : 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, radius, radius * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
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
    const isSelected = unit.id === selectedUnitId;
    const isHovered = unit.id === hoveredUnitId;

    // Draw selection/hover glow BEFORE unit sprite (so it appears behind)
    drawSelectionGlow(ctx, cx, cy, isSelected, isHovered, now);

    // Try generated sprite first
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

    // Draw Civ 6 style banner/flag above unit
    drawCivBanner(ctx, cx - 12, cy, civColor.primary, civColor.secondary);

    // Draw health bar below unit (always show, even at full health for consistency)
    drawHealthBar(ctx, cx, cy, unit.hp, unit.maxHp, 24);

    // Draw movement pips below health bar
    drawMovementPips(ctx, cx, cy, unit.movement, unit.movementLeft);
  }

  ctx.restore();
}

/** Find unit at screen position (for hover detection) */
export function findUnitAtPosition(
  units: Record<string, Unit>,
  screenX: number,
  screenY: number,
  offset: { x: number; y: number },
  zoom: number,
  currentTime?: number,
): string | null {
  const now = currentTime ?? Date.now();
  const hitRadius = 18; // Approximate click/hover radius

  // Check units in reverse order (last rendered = on top)
  const unitList = Object.values(units);
  for (let i = unitList.length - 1; i >= 0; i--) {
    const unit = unitList[i];
    const screen = getUnitScreenPosition(unit, now);
    const cx = (screen.x + TILE_WIDTH / 2) * zoom + offset.x;
    const cy = (screen.y + TILE_HEIGHT / 2 - 4) * zoom + offset.y;

    const dx = screenX - cx;
    const dy = screenY - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= hitRadius * zoom) {
      return unit.id;
    }
  }

  return null;
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
