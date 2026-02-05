import { CombatEffect, CIV_COLORS } from '@/games/civ/types';
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from './TerrainRenderer';

const BASE_EFFECT_DURATION = 1000; // 1 second base duration

/**
 * Renders combat visual effects on the canvas.
 * Effects include:
 * - Attack line from attacker to defender
 * - Red flash/pulse on defender
 * - Floating damage numbers
 * - Explosion effect if unit destroyed
 *
 * @param slowMotionFactor - Factor to scale animation speed (1 = normal, 0.3 = slow motion)
 */
export function renderCombatEffects(
  ctx: CanvasRenderingContext2D,
  combatEffects: CombatEffect[],
  offset: { x: number; y: number },
  zoom: number,
  currentTime: number,
  slowMotionFactor: number = 1,
): void {
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  // Scale effect duration based on slow motion factor (slower = longer duration)
  const effectDuration = BASE_EFFECT_DURATION / slowMotionFactor;

  for (const effect of combatEffects) {
    const elapsed = currentTime - effect.timestamp;
    if (elapsed > effectDuration) continue;

    const progress = elapsed / effectDuration;
    const fadeOut = 1 - progress;

    // During slow motion, enhance the visual drama
    const isSlowMotion = slowMotionFactor < 1;

    // Get screen positions
    const attackerScreen = gridToScreen(effect.attackerX, effect.attackerY);
    const defenderScreen = gridToScreen(effect.defenderX, effect.defenderY);

    const attackerCx = attackerScreen.x + TILE_WIDTH / 2;
    const attackerCy = attackerScreen.y + TILE_HEIGHT / 2;
    const defenderCx = defenderScreen.x + TILE_WIDTH / 2;
    const defenderCy = defenderScreen.y + TILE_HEIGHT / 2;

    // Draw attack line/arc
    drawAttackLine(ctx, attackerCx, attackerCy, defenderCx, defenderCy, progress, fadeOut, effect.attackerCiv, isSlowMotion);

    // Draw red flash on defender
    drawDefenderFlash(ctx, defenderCx, defenderCy, progress, fadeOut, effect.defenderDestroyed, isSlowMotion);

    // Draw floating damage number
    drawDamageNumber(ctx, defenderCx, defenderCy, effect.damage, progress, fadeOut, isSlowMotion);

    // Draw explosion if destroyed
    if (effect.defenderDestroyed) {
      drawExplosion(ctx, defenderCx, defenderCy, progress, isSlowMotion);
    }

    // During slow motion, add extra dramatic effects
    if (isSlowMotion) {
      drawSlowMotionTrails(ctx, attackerCx, attackerCy, defenderCx, defenderCy, progress, effect.attackerCiv);
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
  isSlowMotion: boolean = false,
): void {
  // Line fades in quickly then fades out
  const lineProgress = Math.min(1, progress * 4); // Completes at 25% of total duration
  const lineAlpha = lineProgress < 0.5 ? lineProgress * 2 : fadeOut;

  if (lineAlpha <= 0) return;

  const civColor = CIV_COLORS[attackerCiv]?.primary ?? '#FF4444';

  ctx.save();
  ctx.globalAlpha = lineAlpha * (isSlowMotion ? 1 : 0.8);

  // Main attack line - thicker during slow motion
  ctx.strokeStyle = civColor;
  ctx.lineWidth = isSlowMotion ? 5 : 3;
  ctx.lineCap = 'round';

  // Animated line - grows from attacker to defender
  const endX = ax + (dx - ax) * Math.min(1, lineProgress * 2);
  const endY = ay + (dy - ay) * Math.min(1, lineProgress * 2);

  ctx.beginPath();
  ctx.moveTo(ax, ay - 10);
  ctx.lineTo(endX, endY - 10);
  ctx.stroke();

  // Enhanced glow effect during slow motion
  if (isSlowMotion) {
    ctx.strokeStyle = civColor;
    ctx.lineWidth = 10;
    ctx.globalAlpha = lineAlpha * 0.3;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 10);
    ctx.lineTo(endX, endY - 10);
    ctx.stroke();
  }

  // Glow effect
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = isSlowMotion ? 2 : 1;
  ctx.globalAlpha = lineAlpha * (isSlowMotion ? 0.7 : 0.5);
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
  isSlowMotion: boolean = false,
): void {
  // Flash is strongest at start, then fades - slower fade during slow motion
  const flashIntensity = Math.max(0, 1 - progress * (isSlowMotion ? 1.5 : 2));

  if (flashIntensity <= 0) return;

  ctx.save();

  // Red circle flash - larger during slow motion
  const baseRadius = isSlowMotion ? 30 : 20;
  const radius = baseRadius + progress * (isSlowMotion ? 25 : 15);
  const gradient = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy - 5, radius);
  const intensityMultiplier = isSlowMotion ? 1 : 0.8;
  gradient.addColorStop(0, `rgba(255, ${destroyed ? 100 : 50}, 50, ${flashIntensity * intensityMultiplier})`);
  gradient.addColorStop(0.5, `rgba(255, ${destroyed ? 150 : 100}, 50, ${flashIntensity * intensityMultiplier * 0.5})`);
  gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy - 5, radius, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing ring - thicker and more visible during slow motion
  ctx.strokeStyle = `rgba(255, 100, 100, ${flashIntensity * (isSlowMotion ? 0.9 : 0.7)})`;
  ctx.lineWidth = isSlowMotion ? 3 : 2;
  ctx.beginPath();
  ctx.arc(cx, cy - 5, 15 + progress * (isSlowMotion ? 30 : 20), 0, Math.PI * 2);
  ctx.stroke();

  // Extra outer ring during slow motion
  if (isSlowMotion) {
    ctx.strokeStyle = `rgba(255, 200, 100, ${flashIntensity * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 25 + progress * 40, 0, Math.PI * 2);
    ctx.stroke();
  }

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
  isSlowMotion: boolean = false,
): void {
  ctx.save();

  // Float upward - slower during slow motion for more dramatic effect
  const floatDistance = isSlowMotion ? 60 : 40;
  const floatY = cy - 30 - progress * floatDistance;

  // Scale animation: start big, shrink slightly - larger during slow motion
  const baseScale = isSlowMotion ? 1.5 : 1;
  const scale = baseScale + (1 - progress) * (isSlowMotion ? 0.5 : 0.3);

  ctx.globalAlpha = fadeOut;
  const fontSize = Math.round((isSlowMotion ? 22 : 16) * scale);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Enhanced shadow during slow motion
  if (isSlowMotion) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(`-${damage}`, cx + 2, floatY + 2);
  }

  // Shadow/outline
  ctx.fillStyle = '#000000';
  ctx.fillText(`-${damage}`, cx + 1, floatY + 1);

  // Main text in red - brighter during slow motion
  ctx.fillStyle = isSlowMotion ? '#FF5555' : '#FF3333';
  ctx.fillText(`-${damage}`, cx, floatY);

  // Glow effect during slow motion
  if (isSlowMotion) {
    ctx.globalAlpha = fadeOut * 0.3;
    ctx.fillStyle = '#FF0000';
    ctx.font = `bold ${fontSize + 4}px sans-serif`;
    ctx.fillText(`-${damage}`, cx, floatY);
  }

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
  isSlowMotion: boolean = false,
): void {
  // Explosion is visible from 20% to 80% of the effect duration (extended during slow motion)
  const startThreshold = isSlowMotion ? 0.15 : 0.2;
  const endThreshold = isSlowMotion ? 0.85 : 0.8;
  if (progress < startThreshold || progress > endThreshold) return;

  const explosionProgress = (progress - startThreshold) / (endThreshold - startThreshold); // Normalize to 0-1
  const fadeOut = 1 - explosionProgress;

  ctx.save();

  // Multiple expanding rings - more rings during slow motion
  const colors = isSlowMotion
    ? ['#FF6600', '#FFAA00', '#FF3300', '#FF8800', '#FFCC00']
    : ['#FF6600', '#FFAA00', '#FF3300'];
  const ringCount = isSlowMotion ? 5 : 3;

  for (let i = 0; i < ringCount; i++) {
    const ringProgress = Math.min(1, explosionProgress + i * (isSlowMotion ? 0.08 : 0.1));
    const baseRadius = isSlowMotion ? 15 : 10;
    const expansionMultiplier = isSlowMotion ? 45 : 30;
    const ringRadius = baseRadius + ringProgress * expansionMultiplier + i * (isSlowMotion ? 10 : 8);
    const ringAlpha = fadeOut * (1 - i * (isSlowMotion ? 0.15 : 0.3));

    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = isSlowMotion ? 4 - i * 0.5 : 3 - i;
    ctx.globalAlpha = ringAlpha;
    ctx.beginPath();
    ctx.arc(cx, cy - 5, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Spark particles - more sparks during slow motion
  const sparkCount = isSlowMotion ? 16 : 8;
  for (let i = 0; i < sparkCount; i++) {
    const angle = (i / sparkCount) * Math.PI * 2;
    const baseDistance = isSlowMotion ? 20 : 15;
    const expansionDistance = isSlowMotion ? 40 : 25;
    const distance = baseDistance + explosionProgress * expansionDistance;
    const sparkX = cx + Math.cos(angle) * distance;
    const sparkY = cy - 5 + Math.sin(angle) * distance;

    ctx.globalAlpha = fadeOut * (isSlowMotion ? 1 : 0.8);
    ctx.fillStyle = isSlowMotion ? '#FFFFFF' : '#FFFF00';
    const sparkSize = isSlowMotion ? 3 - explosionProgress * 2 : 2 - explosionProgress * 1.5;
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, Math.max(0.5, sparkSize), 0, Math.PI * 2);
    ctx.fill();

    // Add trail during slow motion
    if (isSlowMotion && explosionProgress > 0.2) {
      const trailDistance = distance * 0.7;
      const trailX = cx + Math.cos(angle) * trailDistance;
      const trailY = cy - 5 + Math.sin(angle) * trailDistance;
      ctx.globalAlpha = fadeOut * 0.4;
      ctx.fillStyle = '#FF8800';
      ctx.beginPath();
      ctx.arc(trailX, trailY, sparkSize * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Central flash during slow motion
  if (isSlowMotion && explosionProgress < 0.4) {
    const flashAlpha = (0.4 - explosionProgress) / 0.4;
    const gradient = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy - 5, 25);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha * 0.8})`);
    gradient.addColorStop(0.3, `rgba(255, 200, 100, ${flashAlpha * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws motion trails during slow motion for extra dramatic effect
 */
function drawSlowMotionTrails(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  progress: number,
  attackerCiv: string,
): void {
  if (progress > 0.5) return; // Only show trails in first half of animation

  const civColor = CIV_COLORS[attackerCiv]?.primary ?? '#FF4444';
  const trailCount = 5;

  ctx.save();

  for (let i = 0; i < trailCount; i++) {
    const trailProgress = Math.max(0, progress - i * 0.03);
    if (trailProgress <= 0) continue;

    const trailAlpha = (1 - i / trailCount) * 0.3 * (1 - progress * 2);
    const trailEndX = ax + (dx - ax) * Math.min(1, trailProgress * 4);
    const trailEndY = ay + (dy - ay) * Math.min(1, trailProgress * 4);

    ctx.strokeStyle = civColor;
    ctx.lineWidth = 2 - i * 0.3;
    ctx.globalAlpha = trailAlpha;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 10 - i * 2);
    ctx.lineTo(trailEndX, trailEndY - 10 - i * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Filters out expired combat effects (older than BASE_EFFECT_DURATION * durationMultiplier)
 */
export function cleanupCombatEffects(
  combatEffects: CombatEffect[],
  currentTime: number,
  durationMultiplier: number = 1,
): CombatEffect[] {
  const effectiveDuration = BASE_EFFECT_DURATION * durationMultiplier;
  return combatEffects.filter(effect => currentTime - effect.timestamp <= effectiveDuration);
}

/**
 * Check if there are any active combat effects
 */
export function hasActiveCombatEffects(
  combatEffects: CombatEffect[],
  currentTime: number,
  durationMultiplier: number = 1,
): boolean {
  const effectiveDuration = BASE_EFFECT_DURATION * durationMultiplier;
  return combatEffects.some(effect => currentTime - effect.timestamp <= effectiveDuration);
}
