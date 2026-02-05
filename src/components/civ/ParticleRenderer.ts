// ============================================================================
// Particle System for Visual Effects
// ============================================================================
// Provides particle effects for combat, city events, and destruction.
// ============================================================================

import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from './TerrainRenderer';

export type ParticleType = 'explosion' | 'sparkle' | 'smoke';

export interface Particle {
  id: string;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
  alpha: number;
  rotation?: number;
  rotationSpeed?: number;
}

export interface ParticleEmitter {
  id: string;
  type: ParticleType;
  gridX: number;
  gridY: number;
  startTime: number;
  duration: number;
  particleCount: number;
  color?: string;
}

// Particle configuration per type
const PARTICLE_CONFIG: Record<ParticleType, {
  baseCount: number;
  colors: string[];
  baseSize: { min: number; max: number };
  speed: { min: number; max: number };
  lifetime: { min: number; max: number };
  gravity: number;
  fadeRate: number;
}> = {
  explosion: {
    baseCount: 20,
    colors: ['#FF6600', '#FFAA00', '#FF3300', '#FFCC00', '#FF4444'],
    baseSize: { min: 3, max: 8 },
    speed: { min: 50, max: 150 },
    lifetime: { min: 300, max: 600 },
    gravity: 80,
    fadeRate: 2,
  },
  sparkle: {
    baseCount: 12,
    colors: ['#FFD700', '#FFFF00', '#FFFACD', '#FFFFFF', '#87CEEB'],
    baseSize: { min: 2, max: 5 },
    speed: { min: 20, max: 60 },
    lifetime: { min: 400, max: 800 },
    gravity: -20, // Float upward
    fadeRate: 1.5,
  },
  smoke: {
    baseCount: 15,
    colors: ['#333333', '#555555', '#777777', '#444444', '#666666'],
    baseSize: { min: 5, max: 12 },
    speed: { min: 10, max: 40 },
    lifetime: { min: 600, max: 1200 },
    gravity: -30, // Rise
    fadeRate: 1,
  },
};

// Generate random value in range
function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Generate unique ID
let particleIdCounter = 0;
function generateParticleId(): string {
  return `p_${Date.now()}_${particleIdCounter++}`;
}

/**
 * Creates particles for a specific effect type at a grid location
 */
export function createParticles(
  type: ParticleType,
  gridX: number,
  gridY: number,
  customColor?: string,
  intensity: number = 1,
): Particle[] {
  const config = PARTICLE_CONFIG[type];
  const screen = gridToScreen(gridX, gridY);
  const centerX = screen.x + TILE_WIDTH / 2;
  const centerY = screen.y + TILE_HEIGHT / 2;

  const particles: Particle[] = [];
  const count = Math.round(config.baseCount * intensity);

  for (let i = 0; i < count; i++) {
    // Random angle for emission direction
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(config.speed.min, config.speed.max);

    const particle: Particle = {
      id: generateParticleId(),
      type,
      x: centerX + randomRange(-5, 5),
      y: centerY + randomRange(-5, 5) - 10, // Offset slightly up
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      lifetime: randomRange(config.lifetime.min, config.lifetime.max),
      maxLifetime: randomRange(config.lifetime.min, config.lifetime.max),
      color: customColor || config.colors[Math.floor(Math.random() * config.colors.length)],
      size: randomRange(config.baseSize.min, config.baseSize.max),
      alpha: 1,
      rotation: type === 'smoke' ? Math.random() * Math.PI * 2 : undefined,
      rotationSpeed: type === 'smoke' ? randomRange(-2, 2) : undefined,
    };

    particle.maxLifetime = particle.lifetime;
    particles.push(particle);
  }

  return particles;
}

/**
 * Updates all particles by delta time (in seconds)
 */
export function updateParticles(particles: Particle[], deltaTime: number): Particle[] {
  const dt = deltaTime;

  return particles.filter(p => {
    // Update lifetime
    p.lifetime -= deltaTime * 1000;
    if (p.lifetime <= 0) return false;

    const config = PARTICLE_CONFIG[p.type];

    // Update position
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Apply gravity
    p.vy += config.gravity * dt;

    // Apply air resistance
    p.vx *= 0.99;
    p.vy *= 0.99;

    // Update alpha based on lifetime
    const lifeRatio = p.lifetime / p.maxLifetime;
    p.alpha = Math.pow(lifeRatio, config.fadeRate);

    // Update size for smoke (grows as it rises)
    if (p.type === 'smoke') {
      p.size += dt * 5;
    }

    // Update rotation for smoke
    if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
      p.rotation += p.rotationSpeed * dt;
    }

    // Sparkles twinkle
    if (p.type === 'sparkle') {
      p.alpha *= 0.7 + Math.sin(Date.now() * 0.02 + parseFloat(p.id.split('_')[1])) * 0.3;
    }

    return true;
  });
}

/**
 * Renders all particles to the canvas
 */
export function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  offset: { x: number; y: number },
  zoom: number,
): void {
  if (particles.length === 0) return;

  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;

    if (p.type === 'explosion') {
      // Draw as glowing circle
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(0.5, p.color);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'sparkle') {
      // Draw as four-pointed star
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);

      // Draw diamond/star shape
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.3, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.3, 0);
      ctx.closePath();
      ctx.fill();

      // Cross shape for sparkle
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(s * 0.3, 0);
      ctx.lineTo(s, 0);
      ctx.lineTo(-s * 0.3, 0);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'smoke') {
      // Draw as blurred circle
      ctx.translate(p.x, p.y);
      if (p.rotation !== undefined) {
        ctx.rotate(p.rotation);
      }

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(0.6, p.color);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * ParticleSystem class for managing particles
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private lastUpdateTime: number = 0;

  constructor() {
    this.lastUpdateTime = Date.now();
  }

  /**
   * Emit particles of a specific type at a grid location
   */
  emit(type: ParticleType, gridX: number, gridY: number, customColor?: string, intensity: number = 1): void {
    const newParticles = createParticles(type, gridX, gridY, customColor, intensity);
    this.particles.push(...newParticles);
  }

  /**
   * Update all particles
   */
  update(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    this.particles = updateParticles(this.particles, deltaTime);
  }

  /**
   * Render all particles
   */
  render(ctx: CanvasRenderingContext2D, offset: { x: number; y: number }, zoom: number): void {
    renderParticles(ctx, this.particles, offset, zoom);
  }

  /**
   * Get current particle count
   */
  getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * Clear all particles
   */
  clear(): void {
    this.particles = [];
  }

  /**
   * Check if there are active particles
   */
  hasActiveParticles(): boolean {
    return this.particles.length > 0;
  }
}

// Singleton particle system instance
export const particleSystem = new ParticleSystem();
