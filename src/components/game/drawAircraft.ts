/**
 * Aircraft drawing utilities - airplanes and helicopters
 * Extracted from CanvasIsometricGrid for better modularity
 */

import { Airplane, Helicopter, TILE_WIDTH, TILE_HEIGHT, PlaneType } from './types';
import {
  AIRPLANE_SPRITE_COLS,
  AIRPLANE_SPRITE_ROWS,
  PLANE_TYPE_ROWS,
  PLANE_DIRECTION_COLS,
  PLANE_SCALES,
} from './constants';
import { getCachedImage } from './imageLoader';

// Cache key for the filtered planes sprite sheet
const AIRPLANE_SPRITE_CACHE_KEY = '/assets/sprites_red_water_new_planes.png';

/**
 * Convert an angle (radians) to one of 8 compass directions
 */
function angleToDirection(angle: number): string {
  // Normalize angle to 0-2PI
  let normalizedAngle = angle % (Math.PI * 2);
  if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
  
  // Convert to degrees for easier understanding
  const degrees = (normalizedAngle * 180) / Math.PI;
  
  // Map to 8 directions (each direction covers 45 degrees)
  // In isometric screen coords:
  // - Right (+X) is East
  // - Down (+Y) is South  
  // - Angle 0 is East (right)
  // - Angle PI/2 is South (down)
  // - Angle PI is West (left)
  // - Angle 3*PI/2 is North (up)
  
  if (degrees >= 337.5 || degrees < 22.5) return 'e';
  if (degrees >= 22.5 && degrees < 67.5) return 'se';
  if (degrees >= 67.5 && degrees < 112.5) return 's';
  if (degrees >= 112.5 && degrees < 157.5) return 'sw';
  if (degrees >= 157.5 && degrees < 202.5) return 'w';
  if (degrees >= 202.5 && degrees < 247.5) return 'nw';
  if (degrees >= 247.5 && degrees < 292.5) return 'n';
  return 'ne'; // 292.5 to 337.5
}

/**
 * Calculate the rotation offset needed to fine-tune sprite to exact angle
 * Uses the baseAngle from the sprite config which accounts for the actual sprite orientation
 */
function getRotationOffset(angle: number, baseAngle: number): number {
  // Normalize angle to 0-2PI
  let normalizedAngle = angle % (Math.PI * 2);
  if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
  
  // Calculate difference between target angle and sprite's base angle
  let diff = normalizedAngle - baseAngle;
  
  // Normalize to -PI to PI range
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  
  return diff;
}

/**
 * Get sprite coordinates for a plane type and direction
 */
function getPlaneSprite(
  planeType: PlaneType,
  direction: string,
  spriteWidth: number,
  spriteHeight: number
): { sx: number; sy: number; sw: number; sh: number; mirrorX: boolean; mirrorY: boolean; baseAngle: number } | null {
  const row = PLANE_TYPE_ROWS[planeType];
  if (row === undefined) return null;
  
  const dirInfo = PLANE_DIRECTION_COLS[direction];
  if (!dirInfo) return null;
  
  const tileWidth = spriteWidth / AIRPLANE_SPRITE_COLS;
  const tileHeight = spriteHeight / AIRPLANE_SPRITE_ROWS;
  
  return {
    sx: dirInfo.col * tileWidth,
    sy: row * tileHeight,
    sw: tileWidth,
    sh: tileHeight,
    mirrorX: dirInfo.mirrorX,
    mirrorY: dirInfo.mirrorY,
    baseAngle: dirInfo.baseAngle,
  };
}

/**
 * Draw airplanes with contrails using sprite sheet
 */
export function drawAirplanes(
  ctx: CanvasRenderingContext2D,
  airplanes: Airplane[],
  viewBounds: { viewLeft: number; viewTop: number; viewRight: number; viewBottom: number },
  hour: number,
  navLightFlashTimer: number,
  isMobile: boolean = false
): void {
  if (airplanes.length === 0) return;

  // Try to get the cached planes sprite sheet
  const planeSprite = getCachedImage(AIRPLANE_SPRITE_CACHE_KEY, true);

  for (const plane of airplanes) {
    // Draw contrails first (behind plane)
    if (plane.contrail.length > 0) {
      ctx.save();
      for (const particle of plane.contrail) {
        // Skip if outside viewport
        if (
          particle.x < viewBounds.viewLeft ||
          particle.x > viewBounds.viewRight ||
          particle.y < viewBounds.viewTop ||
          particle.y > viewBounds.viewBottom
        ) {
          continue;
        }

        const size = 3 + particle.age * 8; // Contrails expand over time
        const opacity = particle.opacity * 0.4 * plane.altitude; // Fade with altitude

        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Skip plane rendering if outside viewport
    if (
      plane.x < viewBounds.viewLeft - 80 ||
      plane.x > viewBounds.viewRight + 80 ||
      plane.y < viewBounds.viewTop - 80 ||
      plane.y > viewBounds.viewBottom + 80
    ) {
      continue;
    }

    // Get direction from angle
    const direction = angleToDirection(plane.angle);
    
    // Draw shadow (when low altitude)
    if (plane.altitude < 0.8) {
      const shadowOffset = (1 - plane.altitude) * 18;
      const shadowOpacity = 0.25 * (1 - plane.altitude);
      const baseScale = PLANE_SCALES[plane.planeType] || 0.6;
      const shadowScale = (0.55 + plane.altitude * 0.35) * baseScale;

      ctx.save();
      ctx.translate(plane.x + shadowOffset, plane.y + shadowOffset * 0.5);
      ctx.scale(shadowScale, shadowScale * 0.5);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
      
      // Simple ellipse shadow
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }

    // Draw airplane sprite
    if (planeSprite) {
      const spriteInfo = getPlaneSprite(
        plane.planeType,
        direction,
        planeSprite.naturalWidth || planeSprite.width,
        planeSprite.naturalHeight || planeSprite.height
      );
      
      if (spriteInfo) {
        ctx.save();
        ctx.translate(plane.x, plane.y);
        
        // Calculate rotation offset to fine-tune to exact angle
        // Use the baseAngle from sprite config which accounts for the actual sprite orientation
        const rotationOffset = getRotationOffset(plane.angle, spriteInfo.baseAngle);
        ctx.rotate(rotationOffset);
        
        // Scale based on altitude and plane type
        const baseScale = PLANE_SCALES[plane.planeType] || 0.3;
        const altitudeScale = 0.7 + plane.altitude * 0.5;
        const totalScale = baseScale * altitudeScale;
        
        // Apply mirroring if needed (mirrorX = horizontal flip, mirrorY = vertical flip)
        const scaleX = spriteInfo.mirrorX ? -totalScale : totalScale;
        const scaleY = spriteInfo.mirrorY ? -totalScale : totalScale;
        ctx.scale(scaleX, scaleY);
        
        // Draw the sprite centered
        ctx.drawImage(
          planeSprite,
          spriteInfo.sx,
          spriteInfo.sy,
          spriteInfo.sw,
          spriteInfo.sh,
          -spriteInfo.sw / 2,
          -spriteInfo.sh / 2,
          spriteInfo.sw,
          spriteInfo.sh
        );
        
        ctx.restore();
        
        // Draw navigation lights at night (on top of sprite)
        const isNight = hour >= 20 || hour < 6;
        if (isNight) {
          drawNavigationLights(ctx, plane, navLightFlashTimer, isMobile, totalScale, spriteInfo.baseAngle, spriteInfo.mirrorX, spriteInfo.mirrorY);
        }
      } else {
        // Fallback to simple drawing if sprite info not found
        drawFallbackAirplane(ctx, plane, hour, navLightFlashTimer, isMobile);
      }
    } else {
      // Fallback to simple drawing if sprite not loaded
      drawFallbackAirplane(ctx, plane, hour, navLightFlashTimer, isMobile);
    }
  }
}

/**
 * Draw navigation lights on top of the plane sprite
 * Draws in world space using the plane's actual flight angle
 */
function drawNavigationLights(
  ctx: CanvasRenderingContext2D,
  plane: Airplane,
  navLightFlashTimer: number,
  isMobile: boolean,
  scale: number,
  _baseAngle: number,
  _mirrorX: boolean,
  _mirrorY: boolean
): void {
  const strobeOn = Math.sin(navLightFlashTimer * 8) > 0.85;
  const beaconOn = Math.sin(navLightFlashTimer * 4) > 0.7;
  
  // Light sizes in world space
  const lightSize = isMobile ? 2.5 : 2;
  const glowSize = lightSize * 1.8;
  
  // Offsets scaled by plane size
  const wingOffset = 12 * scale;
  const tailOffset = 15 * scale;
  
  // Calculate positions based on plane's flight angle
  // perpAngle is 90° to the left of flight direction
  const perpAngle = plane.angle - Math.PI / 2;
  
  // Wing positions (perpendicular to flight direction)
  const leftWingX = plane.x + Math.cos(perpAngle) * wingOffset;
  const leftWingY = plane.y + Math.sin(perpAngle) * wingOffset;
  const rightWingX = plane.x - Math.cos(perpAngle) * wingOffset;
  const rightWingY = plane.y - Math.sin(perpAngle) * wingOffset;
  
  // Tail position (behind plane)
  const tailX = plane.x - Math.cos(plane.angle) * tailOffset;
  const tailY = plane.y - Math.sin(plane.angle) * tailOffset;
  
  ctx.save();
  
  // Red (port/left) nav light - left wingtip
  ctx.fillStyle = '#ff3333';
  if (!isMobile) {
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.arc(leftWingX, leftWingY, lightSize, 0, Math.PI * 2);
  ctx.fill();

  // Green (starboard/right) nav light - right wingtip
  ctx.fillStyle = '#33ff33';
  if (!isMobile) {
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.arc(rightWingX, rightWingY, lightSize, 0, Math.PI * 2);
  ctx.fill();

  // White tail light
  ctx.fillStyle = '#ffffff';
  if (!isMobile) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(tailX, tailY, lightSize * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Red beacon (flashing) - on fuselage center
  if (beaconOn) {
    ctx.fillStyle = '#ff4444';
    if (!isMobile) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.arc(plane.x, plane.y, lightSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // White strobe lights on wingtips (rapid flash)
  if (strobeOn) {
    ctx.fillStyle = '#ffffff';
    if (!isMobile) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 25;
    }
    ctx.beginPath();
    ctx.arc(leftWingX, leftWingY, glowSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightWingX, rightWingY, glowSize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

/**
 * Fallback airplane drawing when sprite is not available
 */
function drawFallbackAirplane(
  ctx: CanvasRenderingContext2D,
  plane: Airplane,
  hour: number,
  navLightFlashTimer: number,
  isMobile: boolean
): void {
  ctx.save();
  ctx.translate(plane.x, plane.y);
  ctx.rotate(plane.angle);

  // Scale based on altitude
  const altitudeScale = 0.7 + plane.altitude * 0.5;
  ctx.scale(altitudeScale, altitudeScale);

  // Simple airplane shape
  ctx.fillStyle = plane.color;
  
  // Fuselage
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Wings
  ctx.beginPath();
  ctx.moveTo(5, -3);
  ctx.lineTo(-5, -20);
  ctx.lineTo(-10, -18);
  ctx.lineTo(-5, -3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, 3);
  ctx.lineTo(-5, 20);
  ctx.lineTo(-10, 18);
  ctx.lineTo(-5, 3);
  ctx.closePath();
  ctx.fill();
  
  // Tail
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(-18, 5);
  ctx.lineTo(-20, 4);
  ctx.lineTo(-18, 0);
  ctx.closePath();
  ctx.fill();

  // Navigation lights at night
  const isNight = hour >= 20 || hour < 6;
  if (isNight) {
    const strobeOn = Math.sin(navLightFlashTimer * 8) > 0.85;
    
    // Red port light
    ctx.fillStyle = '#ff3333';
    if (!isMobile) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.arc(-7, -18, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Green starboard light
    ctx.fillStyle = '#33ff33';
    if (!isMobile) {
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.arc(-7, 18, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // White tail light
    ctx.fillStyle = '#ffffff';
    if (!isMobile) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(-20, 0, 1, 0, Math.PI * 2);
    ctx.fill();

    // Strobe lights
    if (strobeOn) {
      ctx.fillStyle = '#ffffff';
      if (!isMobile) {
        ctx.shadowBlur = 30;
      }
      ctx.beginPath();
      ctx.arc(-9, -17, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-9, 17, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// Helper function to shade a hex color
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

/**
 * Draw helicopters with rotor wash and searchlights at night
 */
export function drawHelicopters(
  ctx: CanvasRenderingContext2D,
  helicopters: Helicopter[],
  viewBounds: { viewLeft: number; viewTop: number; viewRight: number; viewBottom: number },
  hour: number,
  navLightFlashTimer: number,
  isMobile: boolean = false,
  zoom: number = 1
): void {
  if (helicopters.length === 0) return;

  const isNight = hour >= 20 || hour < 6;
  
  // PERF: Skip searchlights when very zoomed out (hard to see anyway)
  const showSearchlights = zoom >= 0.5;

  // First pass: draw all searchlight ground spots (so they appear behind everything)
  // PERF: Skip searchlights on mobile - gradient creation is expensive
  if (isNight && !isMobile && showSearchlights) {
    for (const heli of helicopters) {
      // Only draw searchlight when flying at sufficient altitude
      if (heli.altitude < 0.3 || heli.state === 'landing') continue;

      // Calculate searchlight ground position
      // The light sweeps in a sinusoidal pattern perpendicular to flight direction
      const sweepOffset = Math.sin(heli.searchlightAngle) * heli.searchlightSweepRange;
      const lightAngle = heli.searchlightBaseAngle + sweepOffset;
      
      // Distance from helicopter to ground spot (based on altitude)
      const spotDistance = 40 + heli.altitude * 60;
      
      // Ground spot position
      const spotX = heli.x + Math.cos(lightAngle) * spotDistance;
      const spotY = heli.y + Math.sin(lightAngle) * spotDistance * 0.6; // Flatten for isometric

      // Skip if spot is outside viewport (with margin for the spot size)
      if (
        spotX < viewBounds.viewLeft - 80 ||
        spotX > viewBounds.viewRight + 80 ||
        spotY < viewBounds.viewTop - 80 ||
        spotY > viewBounds.viewBottom + 80
      ) {
        continue;
      }

      // Draw the ground illumination spot (elliptical for isometric perspective)
      const spotRadiusX = 25 + heli.altitude * 20;
      
      // Create radial gradient for soft-edged spotlight
      const gradient = ctx.createRadialGradient(
        spotX, spotY, 0,
        spotX, spotY, spotRadiusX
      );
      
      // Warm yellowish spotlight color
      const intensity = 0.25 + Math.sin(heli.searchlightAngle * 0.3) * 0.05; // Subtle flicker
      gradient.addColorStop(0, `rgba(255, 250, 220, ${intensity})`);
      gradient.addColorStop(0.3, `rgba(255, 245, 200, ${intensity * 0.7})`);
      gradient.addColorStop(0.7, `rgba(255, 240, 180, ${intensity * 0.3})`);
      gradient.addColorStop(1, 'rgba(255, 235, 160, 0)');

      ctx.save();
      ctx.translate(spotX, spotY);
      // Rotate slightly based on light angle for more dynamic look
      ctx.rotate(lightAngle * 0.1);
      ctx.scale(1, 0.5); // Flatten for isometric
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, spotRadiusX, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }

  for (const heli of helicopters) {
    // Draw rotor wash/exhaust particles first (behind helicopter)
    if (heli.rotorWash.length > 0) {
      ctx.save();
      for (const particle of heli.rotorWash) {
        // Skip if outside viewport
        if (
          particle.x < viewBounds.viewLeft ||
          particle.x > viewBounds.viewRight ||
          particle.y < viewBounds.viewTop ||
          particle.y > viewBounds.viewBottom
        ) {
          continue;
        }

        const size = 1.5 + particle.age * 4; // Smaller than plane contrails
        const opacity = particle.opacity * 0.25 * heli.altitude;

        ctx.fillStyle = `rgba(200, 200, 200, ${opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Skip helicopter rendering if outside viewport
    if (
      heli.x < viewBounds.viewLeft - 30 ||
      heli.x > viewBounds.viewRight + 30 ||
      heli.y < viewBounds.viewTop - 30 ||
      heli.y > viewBounds.viewBottom + 30
    ) {
      continue;
    }

    // Draw shadow (always visible since helicopters fly lower)
    const shadowOffset = (0.5 - heli.altitude) * 10 + 3;
    const shadowScale = 0.5 + heli.altitude * 0.3;
    const shadowOpacity = 0.25 * (0.6 - heli.altitude * 0.3);

    ctx.save();
    ctx.translate(heli.x + shadowOffset, heli.y + shadowOffset * 0.5);
    ctx.rotate(heli.angle);
    ctx.scale(shadowScale, shadowScale * 0.5);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw helicopter body
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(heli.angle);

    // Scale based on altitude (smaller than planes)
    const altitudeScale = 0.5 + heli.altitude * 0.3;
    ctx.scale(altitudeScale, altitudeScale);

    // Main body - oval/teardrop shape
    ctx.fillStyle = heli.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit bubble (front)
    ctx.fillStyle = '#87ceeb'; // Light blue glass
    ctx.beginPath();
    ctx.ellipse(5, 0, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail boom
    ctx.fillStyle = heli.color;
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(-16, -0.5);
    ctx.lineTo(-16, 0.5);
    ctx.lineTo(-6, 1);
    ctx.closePath();
    ctx.fill();

    // Tail rotor (vertical)
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.ellipse(-15, 0, 1, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Landing skids
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    // Left skid
    ctx.moveTo(-4, 3.5);
    ctx.lineTo(4, 3.5);
    ctx.moveTo(-2, 4);
    ctx.lineTo(-2, 6);
    ctx.lineTo(2, 6);
    ctx.lineTo(2, 4);
    // Right skid
    ctx.moveTo(-4, -3.5);
    ctx.lineTo(4, -3.5);
    ctx.moveTo(-2, -4);
    ctx.lineTo(-2, -6);
    ctx.lineTo(2, -6);
    ctx.lineTo(2, -4);
    ctx.stroke();

    // Navigation lights at night (hour >= 20 || hour < 6)
    const isNightLocal = hour >= 20 || hour < 6;
    if (isNightLocal) {
      const strobeOn = Math.sin(navLightFlashTimer * 8) > 0.82; // Sharp, brief flash

      // Red nav light on port (left) side
      ctx.fillStyle = '#ff3333';
      // PERF: Skip shadowBlur on mobile - very expensive
      if (!isMobile) {
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      ctx.arc(0, 5, isMobile ? 1.2 : 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Green nav light on starboard (right) side
      ctx.fillStyle = '#33ff33';
      if (!isMobile) {
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      ctx.arc(0, -5, isMobile ? 1.2 : 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Red anti-collision beacon on tail (flashing) - BRIGHT
      if (strobeOn) {
        // Draw multiple layers for intense brightness
        ctx.fillStyle = '#ff4444';
        if (!isMobile) {
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 25;
        }
        ctx.beginPath();
        ctx.arc(-14, 0, isMobile ? 2.5 : 2, 0, Math.PI * 2);
        ctx.fill();
        // Inner bright core
        if (!isMobile) {
          ctx.shadowBlur = 12;
        }
        ctx.beginPath();
        ctx.arc(-14, 0, isMobile ? 1.5 : 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Draw main rotor (drawn separately so it's always on top)
    ctx.save();
    ctx.translate(heli.x, heli.y);

    // Rotor hub
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(0, 0, 2 * altitudeScale, 0, Math.PI * 2);
    ctx.fill();

    // Rotor blades (spinning effect - draw as blurred disc)
    const rotorRadius = 12 * altitudeScale;
    ctx.strokeStyle = `rgba(100, 100, 100, ${0.4 + Math.sin(heli.rotorAngle * 4) * 0.1})`;
    ctx.lineWidth = 1.5 * altitudeScale;
    ctx.beginPath();
    ctx.arc(0, 0, rotorRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw rotor blade lines (2 blades, rotating)
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.6)';
    ctx.lineWidth = 1.5 * altitudeScale;
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(heli.rotorAngle) * rotorRadius,
      Math.sin(heli.rotorAngle) * rotorRadius
    );
    ctx.lineTo(
      Math.cos(heli.rotorAngle + Math.PI) * rotorRadius,
      Math.sin(heli.rotorAngle + Math.PI) * rotorRadius
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(heli.rotorAngle + Math.PI / 2) * rotorRadius,
      Math.sin(heli.rotorAngle + Math.PI / 2) * rotorRadius
    );
    ctx.lineTo(
      Math.cos(heli.rotorAngle + Math.PI * 1.5) * rotorRadius,
      Math.sin(heli.rotorAngle + Math.PI * 1.5) * rotorRadius
    );
    ctx.stroke();

    ctx.restore();

    // Draw searchlight beam at night (when flying)
    // PERF: Skip searchlight beam on mobile or when very zoomed out - gradients and shadowBlur are expensive
    if (isNight && !isMobile && showSearchlights && heli.altitude > 0.3 && heli.state !== 'landing') {
      // Calculate the same spot position as in the first pass
      const sweepOffset = Math.sin(heli.searchlightAngle) * heli.searchlightSweepRange;
      const lightAngle = heli.searchlightBaseAngle + sweepOffset;
      const spotDistance = 40 + heli.altitude * 60;
      const spotX = heli.x + Math.cos(lightAngle) * spotDistance;
      const spotY = heli.y + Math.sin(lightAngle) * spotDistance * 0.6;

      // Draw the beam from helicopter to ground spot
      ctx.save();
      
      // Create a gradient for the beam (brighter at helicopter, fades toward ground)
      const beamGradient = ctx.createLinearGradient(heli.x, heli.y, spotX, spotY);
      beamGradient.addColorStop(0, 'rgba(255, 250, 220, 0.4)');
      beamGradient.addColorStop(0.3, 'rgba(255, 250, 220, 0.15)');
      beamGradient.addColorStop(1, 'rgba(255, 250, 220, 0.02)');

      // Draw beam as a cone (triangle from helicopter to spread at ground)
      const perpAngle1 = lightAngle + Math.PI / 2;
      const perpAngle2 = lightAngle - Math.PI / 2;
      const spotRadiusX = 25 + heli.altitude * 20;
      
      // Calculate spread points at the ground
      const spreadX1 = spotX + Math.cos(perpAngle1) * spotRadiusX * 0.6;
      const spreadY1 = spotY + Math.sin(perpAngle1) * spotRadiusX * 0.3;
      const spreadX2 = spotX + Math.cos(perpAngle2) * spotRadiusX * 0.6;
      const spreadY2 = spotY + Math.sin(perpAngle2) * spotRadiusX * 0.3;

      ctx.fillStyle = beamGradient;
      ctx.beginPath();
      ctx.moveTo(heli.x, heli.y);
      ctx.lineTo(spreadX1, spreadY1);
      ctx.lineTo(spreadX2, spreadY2);
      ctx.closePath();
      ctx.fill();

      // Add a bright point at the helicopter (searchlight source)
      const lightAltitudeScale = 0.5 + heli.altitude * 0.3;
      ctx.fillStyle = 'rgba(255, 255, 240, 0.9)';
      ctx.shadowColor = '#ffffcc';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(heli.x, heli.y + 3 * lightAltitudeScale, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.restore();
    }
  }
}
