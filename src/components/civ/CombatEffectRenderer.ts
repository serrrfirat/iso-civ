import { CombatEffect, CIV_COLORS } from '@/games/civ/types';
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from './TerrainRenderer';

const EFFECT_DURATION = 1000; // 1 second

/**
 * Renders combat visual effects on the canvas.
 * Effects include:
 * - Attack line from attacker to defender
 * - Red flash/pulse on defender
 * - Floating damage numbers
 * - Explosion effect if unit destroyed
 */
export function renderCombatEffects(
  ctx: CanvasRenderingContext2D,
  combatEffects: CombatEffect[],
  offset: { x: number; y: number },
  zoom: number,
  currentTime: number,
): void {
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  for (const effect of combatEffects) {
    const elapsed = currentTime - effect.timestamp;
    if (elapsed > EFFECT_DURATION) continue;

    const progress = elapsed / EFFECT_DURATION;
    const fadeOut = 1 - progress;

    // Get screen positions
    const attackerScreen = gridToScreen(effect.attackerX, effect.attackerY);
    const defenderScreen = gridToScreen(effect.defenderX, effect.defenderY);

    const attackerCx = attackerScreen.x + TILE_WIDTH / 2;
    const attackerCy = attackerScreen.y + TILE_HEIGHT / 2;
    const defenderCx = defenderScreen.x + TILE_WIDTH / 2;
    const defenderCy = defenderScreen.y + TILE_HEIGHT / 2;

    // Draw attack line/arc
    drawAttackLine(ctx, attackerCx, attackerCy, defenderCx, defenderCy, progress, fadeOut, effect.attackerCiv);

    // Draw red flash on defender
    drawDefenderFlash(ctx, defenderCx, defenderCy, progress, fadeOut, effect.defenderDestroyed);

    // Draw floating damage number
    drawDamageNumber(ctx, defenderCx, defenderCy, effect.damage, progress, fadeOut);

    // Draw explosion if destroyed
    if (effect.defenderDestroyed) {
      drawExplosion(ctx, defenderCx, defenderCy, progress);
    }
  }

  ctx.restore();
}

/**
 * Draws an attack line/arc from attacker to defender
 */
function drawAttackLine(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  progress: number,
  fadeOut: number,
  attackerCiv: string,
): void {
  // Line fades in quickly then fades out
  const lineProgress = Math.min(1, progress * 4); // Completes at 25% of total duration
  const lineAlpha = lineProgress < 0.5 ? lineProgress * 2 : fadeOut;

  if (lineAlpha <= 0) return;

  const civColor = CIV_COLORS[attackerCiv]?.primary ?? '#FF4444';

  ctx.save();
  ctx.globalAlpha = lineAlpha * 0.8;

  // Main attack line
  ctx.strokeStyle = civColor;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Animated line - grows from attacker to defender
  const endX = ax + (dx - ax) * Math.min(1, lineProgress * 2);
  const endY = ay + (dy - ay) * Math.min(1, lineProgress * 2);

  ctx.beginPath();
  ctx.moveTo(ax, ay - 10);
  ctx.lineTo(endX, endY - 10);
  ctx.stroke();

  // Glow effect
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.globalAlpha = lineAlpha * 0.5;
  ctx.beginPath();
  ctx.moveTo(ax, ay - 10);
  ctx.lineTo(endX, endY - 10);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a red flash/pulse effect on the defender
 */
function drawDefenderFlash(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  progress: number,
  fadeOut: number,
  destroyed: boolean,
): void {
  // Flash is strongest at start, then fades
  const flashIntensity = Math.max(0, 1 - progress * 2);

  if (flashIntensity <= 0) return;

  ctx.save();

  // Red circle flash
  const radius = 20 + progress * 15;
  const gradient = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy - 5, radius);
  gradient.addColorStop(0, `rgba(255, ${destroyed ? 100 : 50}, 50, ${flashIntensity * 0.8})`);
  gradient.addColorStop(0.5, `rgba(255, ${destroyed ? 150 : 100}, 50, ${flashIntensity * 0.4})`);
  gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy - 5, radius, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing ring
  ctx.strokeStyle = `rgba(255, 100, 100, ${flashIntensity * 0.7})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy - 5, 15 + progress * 20, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws floating damage number that rises and fades
 */
function drawDamageNumber(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  damage: number,
  progress: number,
  fadeOut: number,
): void {
  ctx.save();

  // Float upward
  const floatY = cy - 30 - progress * 40;

  // Scale animation: start big, shrink slightly
  const scale = 1 + (1 - progress) * 0.3;

  ctx.globalAlpha = fadeOut;
  ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow/outline
  ctx.fillStyle = '#000000';
  ctx.fillText(`-${damage}`, cx + 1, floatY + 1);

  // Main text in red
  ctx.fillStyle = '#FF3333';
  ctx.fillText(`-${damage}`, cx, floatY);

  ctx.restore();
}

/**
 * Draws an explosion effect when a unit is destroyed
 */
function drawExplosion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  progress: number,
): void {
  // Explosion is visible from 20% to 80% of the effect duration
  if (progress < 0.2 || progress > 0.8) return;

  const explosionProgress = (progress - 0.2) / 0.6; // Normalize to 0-1
  const fadeOut = 1 - explosionProgress;

  ctx.save();

  // Multiple expanding rings
  const colors = ['#FF6600', '#FFAA00', '#FF3300'];
  for (let i = 0; i < 3; i++) {
    const ringProgress = Math.min(1, explosionProgress + i * 0.1);
    const ringRadius = 10 + ringProgress * 30 + i * 8;
    const ringAlpha = fadeOut * (1 - i * 0.3);

    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 3 - i;
    ctx.globalAlpha = ringAlpha;
    ctx.beginPath();
    ctx.arc(cx, cy - 5, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Spark particles
  const sparkCount = 8;
  for (let i = 0; i < sparkCount; i++) {
    const angle = (i / sparkCount) * Math.PI * 2;
    const distance = 15 + explosionProgress * 25;
    const sparkX = cx + Math.cos(angle) * distance;
    const sparkY = cy - 5 + Math.sin(angle) * distance;

    ctx.globalAlpha = fadeOut * 0.8;
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 2 - explosionProgress * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Filters out expired combat effects (older than EFFECT_DURATION)
 */
export function cleanupCombatEffects(combatEffects: CombatEffect[], currentTime: number): CombatEffect[] {
  return combatEffects.filter(effect => currentTime - effect.timestamp <= EFFECT_DURATION);
}

/**
 * Check if there are any active combat effects
 */
export function hasActiveCombatEffects(combatEffects: CombatEffect[], currentTime: number): boolean {
  return combatEffects.some(effect => currentTime - effect.timestamp <= EFFECT_DURATION);
}
