/**
 * Aircraft drawing utilities - airplanes and helicopters
 * Extracted from CanvasIsometricGrid for better modularity
 */

import { Airplane, Helicopter, TILE_WIDTH, TILE_HEIGHT } from './types';

/**
 * Draw airplanes with contrails
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
      plane.x < viewBounds.viewLeft - 50 ||
      plane.x > viewBounds.viewRight + 50 ||
      plane.y < viewBounds.viewTop - 50 ||
      plane.y > viewBounds.viewBottom + 50
    ) {
      continue;
    }

    // Draw shadow (when low altitude) - matches the detailed airplane shape
    if (plane.altitude < 0.8) {
      const shadowOffset = (1 - plane.altitude) * 18;
      const shadowScale = 0.55 + plane.altitude * 0.35;
      const shadowOpacity = 0.25 * (1 - plane.altitude);

      ctx.save();
      ctx.translate(plane.x + shadowOffset, plane.y + shadowOffset * 0.5);
      ctx.rotate(plane.angle);
      ctx.scale(shadowScale, shadowScale * 0.5);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
      
      // More detailed shadow matching airplane silhouette
      ctx.beginPath();
      // Fuselage shadow
      ctx.ellipse(0, 0, 24, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wing shadows
      ctx.beginPath();
      ctx.moveTo(6, -4);
      ctx.lineTo(-8, -26);
      ctx.lineTo(-14, -25);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, 4);
      ctx.lineTo(-8, 26);
      ctx.lineTo(-14, 25);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();
      // Tail fin shadow (matches centered fin)
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-19, -7);
      ctx.lineTo(-23, -6);
      ctx.lineTo(-22, 0);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }

    // Draw airplane - detailed commercial airliner
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.angle);

    // Scale based on altitude (appears larger when higher/closer)
    const altitudeScale = 0.7 + plane.altitude * 0.5;
    ctx.scale(altitudeScale, altitudeScale);

    // Determine if it's a darker/lighter livery for shading
    const isWhitePlane = plane.color === '#ffffff' || plane.color === '#FFFFFF';
    const darkerShade = isWhitePlane ? '#d1d5db' : shadeColor(plane.color, -30);
    const lighterShade = isWhitePlane ? '#ffffff' : shadeColor(plane.color, 20);
    const darkAccent = '#1e293b';

    // === WINGS (draw first, behind fuselage) ===
    // Main wings - swept back design with realistic shape
    // Left wing (top in view)
    ctx.fillStyle = darkerShade;
    ctx.beginPath();
    ctx.moveTo(6, -3.2);  // Wing root leading edge (matches fuselage)
    ctx.lineTo(-6, -24);   // Wingtip leading edge
    ctx.lineTo(-12, -23);  // Wingtip trailing edge
    ctx.lineTo(-6, -3.2);  // Wing root trailing edge
    ctx.closePath();
    ctx.fill();
    
    // Wing highlight (top surface shine)
    ctx.fillStyle = lighterShade;
    ctx.beginPath();
    ctx.moveTo(4, -3.2);
    ctx.lineTo(-4, -20);
    ctx.lineTo(-6, -19);
    ctx.lineTo(-2, -3.2);
    ctx.closePath();
    ctx.fill();

    // Right wing (bottom in view)
    ctx.fillStyle = darkerShade;
    ctx.beginPath();
    ctx.moveTo(6, 3.2);
    ctx.lineTo(-6, 24);
    ctx.lineTo(-12, 23);
    ctx.lineTo(-6, 3.2);
    ctx.closePath();
    ctx.fill();
    
    // Wing highlight
    ctx.fillStyle = lighterShade;
    ctx.beginPath();
    ctx.moveTo(4, 3.2);
    ctx.lineTo(-4, 20);
    ctx.lineTo(-6, 19);
    ctx.lineTo(-2, 3.2);
    ctx.closePath();
    ctx.fill();

    // === ENGINE NACELLES (underwing mounted, isometric-friendly) ===
    // Engines positioned at ~40% wing span
    const engineY = 14; // Distance from centerline (under wing)
    const engineX = -2; // Slightly behind wing leading edge
    
    // Left engine - elongated pod shape hanging below wing
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(engineX + 4, -engineY + 1);
    ctx.lineTo(engineX - 4, -engineY + 1);
    ctx.lineTo(engineX - 5, -engineY);
    ctx.lineTo(engineX - 4, -engineY - 1);
    ctx.lineTo(engineX + 4, -engineY - 1);
    ctx.lineTo(engineX + 5, -engineY);
    ctx.closePath();
    ctx.fill();
    // Engine body (lighter top)
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(engineX + 4, -engineY + 1);
    ctx.lineTo(engineX - 4, -engineY + 1);
    ctx.lineTo(engineX - 4, -engineY);
    ctx.lineTo(engineX + 4, -engineY);
    ctx.closePath();
    ctx.fill();
    // Engine pylon connecting to wing
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(engineX - 1, -engineY + 3);
    ctx.lineTo(engineX + 1, -engineY + 3);
    ctx.lineTo(engineX + 1, -engineY + 1);
    ctx.lineTo(engineX - 1, -engineY + 1);
    ctx.closePath();
    ctx.fill();

    // Right engine - elongated pod shape
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(engineX + 4, engineY - 1);
    ctx.lineTo(engineX - 4, engineY - 1);
    ctx.lineTo(engineX - 5, engineY);
    ctx.lineTo(engineX - 4, engineY + 1);
    ctx.lineTo(engineX + 4, engineY + 1);
    ctx.lineTo(engineX + 5, engineY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(engineX + 4, engineY - 1);
    ctx.lineTo(engineX - 4, engineY - 1);
    ctx.lineTo(engineX - 4, engineY);
    ctx.lineTo(engineX + 4, engineY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(engineX - 1, engineY - 3);
    ctx.lineTo(engineX + 1, engineY - 3);
    ctx.lineTo(engineX + 1, engineY - 1);
    ctx.lineTo(engineX - 1, engineY - 1);
    ctx.closePath();
    ctx.fill();

    // === HORIZONTAL STABILIZERS (tail wings) ===
    ctx.fillStyle = darkerShade;
    // Left stabilizer
    ctx.beginPath();
    ctx.moveTo(-18, -2);
    ctx.lineTo(-22, -9);
    ctx.lineTo(-26, -8);
    ctx.lineTo(-22, -2);
    ctx.closePath();
    ctx.fill();
    // Right stabilizer
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.lineTo(-22, 9);
    ctx.lineTo(-26, 8);
    ctx.lineTo(-22, 2);
    ctx.closePath();
    ctx.fill();

    // === FUSELAGE ===
    // Main body - cylindrical with tapered nose and tail
    const gradient = ctx.createLinearGradient(0, -4, 0, 4);
    gradient.addColorStop(0, lighterShade);
    gradient.addColorStop(0.3, plane.color);
    gradient.addColorStop(0.7, plane.color);
    gradient.addColorStop(1, darkerShade);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    // Start from tail, go around clockwise
    ctx.moveTo(-22, -2.5);
    // Tail section taper
    ctx.lineTo(-18, -3.2);
    // Main body top
    ctx.lineTo(12, -3.2);
    // Nose cone curve
    ctx.quadraticCurveTo(20, -2.5, 24, 0);
    ctx.quadraticCurveTo(20, 2.5, 12, 3.2);
    // Main body bottom
    ctx.lineTo(-18, 3.2);
    // Tail section
    ctx.lineTo(-22, 2.5);
    ctx.quadraticCurveTo(-24, 0, -22, -2.5);
    ctx.closePath();
    ctx.fill();

    // Fuselage highlight stripe (belly reflection)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();

    // === COCKPIT GLASS ===
    // Simple thin cockpit windshield band
    ctx.fillStyle = '#38bdf8'; // Sky blue glass
    ctx.beginPath();
    ctx.moveTo(18, -2.2);
    ctx.quadraticCurveTo(23, -1.5, 24, 0);
    ctx.quadraticCurveTo(23, 1.5, 18, 2.2);
    ctx.lineTo(18, 1.6);
    ctx.quadraticCurveTo(21, 1, 22, 0);
    ctx.quadraticCurveTo(21, -1, 18, -1.6);
    ctx.closePath();
    ctx.fill();

    // === VERTICAL TAIL FIN (rises from center-top of tail section) ===
    // Simple swept fin that rises from the fuselage spine
    ctx.fillStyle = darkerShade;
    ctx.beginPath();
    ctx.moveTo(-18, 0);      // Base at fuselage centerline
    ctx.lineTo(-19, -6);     // Rises up and back
    ctx.lineTo(-23, -5);     // Top back corner
    ctx.lineTo(-22, 0);      // Back to centerline
    ctx.closePath();
    ctx.fill();
    
    // Fin highlight edge (front face)
    ctx.fillStyle = plane.color;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-19, -5);
    ctx.lineTo(-20, -4.5);
    ctx.lineTo(-19, 0);
    ctx.closePath();
    ctx.fill();

    // === APU EXHAUST (tail cone) ===
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.ellipse(-23, 0, 1.2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // === NAVIGATION LIGHTS ===
    const isNight = hour >= 20 || hour < 6;
    if (isNight) {
      const strobeOn = Math.sin(navLightFlashTimer * 8) > 0.85;
      const beaconOn = Math.sin(navLightFlashTimer * 4) > 0.7;

      // Red nav light on port (left) wingtip
      ctx.fillStyle = '#ff3333';
      // PERF: Skip shadowBlur on mobile - very expensive
      if (!isMobile) {
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
      }
      ctx.beginPath();
      ctx.arc(-9, -23, isMobile ? 2 : 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Green nav light on starboard (right) wingtip
      ctx.fillStyle = '#33ff33';
      if (!isMobile) {
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 15;
      }
      ctx.beginPath();
      ctx.arc(-9, 23, isMobile ? 2 : 1.5, 0, Math.PI * 2);
      ctx.fill();

      // White tail navigation light
      ctx.fillStyle = '#ffffff';
      if (!isMobile) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      ctx.arc(-23.5, 0, isMobile ? 1.5 : 1, 0, Math.PI * 2);
      ctx.fill();

      // Red beacon on top of fuselage (flashing)
      if (beaconOn) {
        ctx.fillStyle = '#ff4444';
        if (!isMobile) {
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 20;
        }
        ctx.beginPath();
        ctx.arc(-5, -3.5, isMobile ? 1.8 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // White strobe lights on wingtips (rapid flash)
      if (strobeOn) {
        ctx.fillStyle = '#ffffff';
        if (!isMobile) {
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 40;
        }
        ctx.beginPath();
        ctx.arc(-11, -22, isMobile ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-11, 22, isMobile ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
        // Tail strobe (on top of fin)
        if (!isMobile) {
          ctx.shadowBlur = 25;
        }
        ctx.beginPath();
        ctx.arc(-21, -5, isMobile ? 1.8 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Landing lights (on wing roots, bright forward-facing)
      ctx.fillStyle = '#fffde7';
      if (!isMobile) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 25;
      }
      ctx.beginPath();
      ctx.arc(4, -6, isMobile ? 2 : 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, 6, isMobile ? 2 : 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    } else {
      // Daytime - subtle light housings visible
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(-9, -23, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(-9, 23, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
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
