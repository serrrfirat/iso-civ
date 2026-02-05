import { City, CIV_COLORS } from '@/games/civ/types';
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from './TerrainRenderer';

// ============================================================================
// City Banner Renderer — Civ 6 style floating banners above cities
// ============================================================================

// Banner configuration
const BANNER_CONFIG = {
  offsetY: -50, // How far above the city sprite
  height: 24,
  minWidth: 80,
  maxWidth: 160,
  padding: 8,
  borderRadius: 4,
  popCircleRadius: 10,
  defenseBarHeight: 4,
  productionIconSize: 16,
  goldBorderWidth: 2,
};

// Production icons mapping
const PRODUCTION_ICONS: Record<string, string> = {
  warrior: '\u2694', // Crossed swords
  archer: '\u{1F3F9}', // Bow and arrow - fallback to text
  scout: '\u{1F463}', // Footprints
  settler: '\u{1F3E0}', // House
  worker: '\u{1F528}', // Hammer
  catapult: '\u{1F4A3}', // Bomb
  horseman: '\u{1F40E}', // Horse
  swordsman: '\u2694',
  crossbowman: '\u{1F3F9}',
  knight: '\u265E', // Chess knight
  musketman: '\u{1F52B}',
  cannon: '\u{1F4A5}',
  infantry: '\u{1F94A}',
  tank: '\u{1F699}',
  caravan: '\u{1F4E6}', // Package for trade
  granary: '\u{1F33E}', // Wheat
  library: '\u{1F4DA}', // Books
  barracks: '\u{1F6E1}', // Shield
  walls: '\u{1F3F0}', // Castle
  market: '\u{1F4B0}', // Money bag
  workshop: '\u2699', // Gear
  temple: '\u26EA', // Church
  university: '\u{1F393}', // Graduation cap
  bank: '\u{1F3E6}', // Bank building
  factory: '\u{1F3ED}', // Factory
  hospital: '\u{1F3E5}', // Hospital
  aqueduct: '\u{1F4A7}', // Water drop
  colosseum: '\u{1F3DF}', // Stadium
};

/**
 * Draw text with an outline for readability on any background
 */
function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  outlineColor: string,
  outlineWidth: number = 2
): void {
  ctx.save();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw a rounded rectangle
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Render a single city banner
 */
function renderCityBanner(
  ctx: CanvasRenderingContext2D,
  city: City,
  screenX: number,
  screenY: number,
  zoom: number
): void {
  const civColor = CIV_COLORS[city.ownerId] ?? { primary: '#888888', secondary: '#CCCCCC' };

  // Calculate banner position (centered above city)
  const bannerCenterX = screenX + TILE_WIDTH / 2;
  const bannerY = screenY + BANNER_CONFIG.offsetY;

  // Calculate banner width based on city name length
  ctx.font = 'bold 11px sans-serif';
  const nameWidth = ctx.measureText(city.name).width;
  const bannerWidth = Math.min(
    BANNER_CONFIG.maxWidth,
    Math.max(BANNER_CONFIG.minWidth, nameWidth + BANNER_CONFIG.padding * 2 + BANNER_CONFIG.popCircleRadius * 2 + BANNER_CONFIG.productionIconSize + 16)
  );

  const bannerX = bannerCenterX - bannerWidth / 2;

  // Draw subtle shadow/glow for depth
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Main banner background with civ color
  drawRoundedRect(
    ctx,
    bannerX,
    bannerY,
    bannerWidth,
    BANNER_CONFIG.height,
    BANNER_CONFIG.borderRadius
  );

  // Fill with gradient for depth
  const gradient = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + BANNER_CONFIG.height);
  gradient.addColorStop(0, civColor.primary);
  gradient.addColorStop(0.5, civColor.primary);
  gradient.addColorStop(1, shadeColor(civColor.primary, -20));
  ctx.fillStyle = gradient;
  ctx.fill();

  // Reset shadow for stroke
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Gold border accent
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = BANNER_CONFIG.goldBorderWidth;
  ctx.stroke();

  // Inner highlight line at top
  ctx.beginPath();
  ctx.moveTo(bannerX + BANNER_CONFIG.borderRadius, bannerY + 1);
  ctx.lineTo(bannerX + bannerWidth - BANNER_CONFIG.borderRadius, bannerY + 1);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  // Population circle on left
  const popCircleX = bannerX + BANNER_CONFIG.popCircleRadius + 4;
  const popCircleY = bannerY + BANNER_CONFIG.height / 2;

  // Population circle background
  ctx.beginPath();
  ctx.arc(popCircleX, popCircleY, BANNER_CONFIG.popCircleRadius, 0, Math.PI * 2);
  ctx.fillStyle = civColor.secondary;
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Population number
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawOutlinedText(
    ctx,
    city.population.toString(),
    popCircleX,
    popCircleY,
    '#FFFFFF',
    '#000000',
    2
  );

  // City name (centered in remaining space)
  const nameStartX = popCircleX + BANNER_CONFIG.popCircleRadius + 4;
  const nameEndX = bannerX + bannerWidth - (city.currentProduction ? BANNER_CONFIG.productionIconSize + 6 : 4);
  const nameCenterX = (nameStartX + nameEndX) / 2;

  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawOutlinedText(
    ctx,
    city.name,
    nameCenterX,
    bannerY + BANNER_CONFIG.height / 2,
    '#FFFFFF',
    '#000000',
    2
  );

  // Production icon on right (if producing something)
  if (city.currentProduction) {
    const prodX = bannerX + bannerWidth - BANNER_CONFIG.productionIconSize - 4;
    const prodY = bannerY + (BANNER_CONFIG.height - BANNER_CONFIG.productionIconSize) / 2;

    // Production progress ring
    const progress = city.currentProduction.progress / city.currentProduction.cost;
    const iconCenterX = prodX + BANNER_CONFIG.productionIconSize / 2;
    const iconCenterY = prodY + BANNER_CONFIG.productionIconSize / 2;
    const ringRadius = BANNER_CONFIG.productionIconSize / 2 - 1;

    // Background circle
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, ringRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    // Progress arc
    ctx.beginPath();
    ctx.moveTo(iconCenterX, iconCenterY);
    ctx.arc(iconCenterX, iconCenterY, ringRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#4CAF50';
    ctx.fill();

    // Production icon or letter
    const icon = PRODUCTION_ICONS[city.currentProduction.target];
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (icon) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(icon, iconCenterX, iconCenterY);
    } else {
      // Fallback: first letter of production target
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(city.currentProduction.target[0].toUpperCase(), iconCenterX, iconCenterY);
    }
  }

  // Defense/health bar below banner
  const defenseBarWidth = bannerWidth - 8;
  const defenseBarX = bannerX + 4;
  const defenseBarY = bannerY + BANNER_CONFIG.height + 2;

  // Defense bar background (gray for max defense)
  ctx.fillStyle = '#444444';
  drawRoundedRect(
    ctx,
    defenseBarX,
    defenseBarY,
    defenseBarWidth,
    BANNER_CONFIG.defenseBarHeight,
    2
  );
  ctx.fill();
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Current defense (green portion)
  const maxDefense = 20; // Default max city defense
  const defenseRatio = Math.min(1, city.defense / maxDefense);
  if (defenseRatio > 0) {
    const currentDefenseWidth = defenseBarWidth * defenseRatio;

    // Color based on defense level
    let defenseColor = '#22C55E'; // Green for healthy
    if (defenseRatio < 0.3) {
      defenseColor = '#EF4444'; // Red for critical
    } else if (defenseRatio < 0.6) {
      defenseColor = '#F59E0B'; // Orange for damaged
    }

    drawRoundedRect(
      ctx,
      defenseBarX,
      defenseBarY,
      currentDefenseWidth,
      BANNER_CONFIG.defenseBarHeight,
      2
    );
    ctx.fillStyle = defenseColor;
    ctx.fill();
  }

  // Connection line from banner to city (subtle)
  ctx.beginPath();
  ctx.moveTo(bannerCenterX, bannerY + BANNER_CONFIG.height + BANNER_CONFIG.defenseBarHeight + 2);
  ctx.lineTo(bannerCenterX, bannerY + BANNER_CONFIG.height + BANNER_CONFIG.defenseBarHeight + 10);
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Shade a hex color by a percentage (negative = darker, positive = lighter)
 */
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Render city banners for all cities
 * Should be called after rendering cities for proper layering
 */
export function renderCityBanners(
  ctx: CanvasRenderingContext2D,
  cities: Record<string, City>,
  offset: { x: number; y: number },
  zoom: number
): void {
  // Don't render banners when zoomed out too far
  if (zoom < 0.4) return;

  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  // Sort cities by Y position for proper banner overlap rendering
  const sortedCities = Object.values(cities).sort((a, b) => a.y - b.y);

  for (const city of sortedCities) {
    const screen = gridToScreen(city.x, city.y);
    renderCityBanner(ctx, city, screen.x, screen.y, zoom);
  }

  ctx.restore();
}
