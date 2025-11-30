import { useCallback } from 'react';
import { Seaplane, WorldRenderState, TILE_WIDTH, TILE_HEIGHT, WakeParticle } from './types';
import {
  SEAPLANE_MIN_POPULATION,
  SEAPLANE_MIN_BAY_SIZE,
  SEAPLANE_COLORS,
  MAX_SEAPLANES,
  SEAPLANE_SPAWN_INTERVAL_MIN,
  SEAPLANE_SPAWN_INTERVAL_MAX,
  SEAPLANE_TAXI_TIME_MIN,
  SEAPLANE_TAXI_TIME_MAX,
  SEAPLANE_FLIGHT_TIME_MIN,
  SEAPLANE_FLIGHT_TIME_MAX,
  SEAPLANE_WATER_SPEED,
  SEAPLANE_TAKEOFF_SPEED,
  SEAPLANE_FLIGHT_SPEED_MIN,
  SEAPLANE_FLIGHT_SPEED_MAX,
  SEAPLANE_MIN_ZOOM,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  WAKE_MAX_AGE,
  WAKE_SPAWN_INTERVAL,
} from './constants';
import { findBays, getRandomBayTile, isOverWater, BayInfo } from './gridFinders';

export interface SeaplaneSystemRefs {
  seaplanesRef: React.MutableRefObject<Seaplane[]>;
  seaplaneIdRef: React.MutableRefObject<number>;
  seaplaneSpawnTimerRef: React.MutableRefObject<number>;
}

export interface SeaplaneSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedPopulationRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  isMobile: boolean;
}

export function useSeaplaneSystem(
  refs: SeaplaneSystemRefs,
  systemState: SeaplaneSystemState
) {
  const { seaplanesRef, seaplaneIdRef, seaplaneSpawnTimerRef } = refs;
  const { worldStateRef, gridVersionRef, cachedPopulationRef, isMobile } = systemState;

  // Find bays callback
  const findBaysCallback = useCallback((): BayInfo[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findBays(currentGrid, currentGridSize, SEAPLANE_MIN_BAY_SIZE);
  }, [worldStateRef]);

  // Check if screen position is over water callback
  const isOverWaterCallback = useCallback((screenX: number, screenY: number): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return isOverWater(currentGrid, currentGridSize, screenX, screenY);
  }, [worldStateRef]);

  // Update seaplanes - spawn, move, and manage lifecycle
  const updateSeaplanes = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Clear seaplanes if zoomed out too far
    if (currentZoom < SEAPLANE_MIN_ZOOM) {
      seaplanesRef.current = [];
      return;
    }

    // Find bays
    const bays = findBaysCallback();
    
    // Get cached population count
    const currentGridVersion = gridVersionRef.current;
    let totalPopulation: number;
    if (cachedPopulationRef.current.gridVersion === currentGridVersion) {
      totalPopulation = cachedPopulationRef.current.count;
    } else {
      // Recalculate and cache
      totalPopulation = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          totalPopulation += currentGrid[y][x].building.population || 0;
        }
      }
      cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
    }

    // No seaplanes if no bays or insufficient population
    if (bays.length === 0 || totalPopulation < SEAPLANE_MIN_POPULATION) {
      seaplanesRef.current = [];
      return;
    }

    // Calculate max seaplanes based on population and bay count
    const populationBased = Math.floor(totalPopulation / 3000);
    const bayBased = Math.floor(bays.length * 3);
    const maxSeaplanes = Math.min(MAX_SEAPLANES, Math.max(2, Math.min(populationBased, bayBased)));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    seaplaneSpawnTimerRef.current -= delta;
    if (seaplanesRef.current.length < maxSeaplanes && seaplaneSpawnTimerRef.current <= 0) {
      // Pick a random bay
      const bay = bays[Math.floor(Math.random() * bays.length)];
      
      // Get a random tile in the bay for spawn position
      const spawnTile = getRandomBayTile(bay);
      
      // Random initial angle
      const angle = Math.random() * Math.PI * 2;
      
      seaplanesRef.current.push({
        id: seaplaneIdRef.current++,
        x: spawnTile.screenX,
        y: spawnTile.screenY,
        angle: angle,
        targetAngle: angle,
        state: 'taxiing_water',
        speed: SEAPLANE_WATER_SPEED * (0.8 + Math.random() * 0.4),
        altitude: 0,
        targetAltitude: 0,
        bayTileX: bay.centerX,
        bayTileY: bay.centerY,
        bayScreenX: bay.screenX,
        bayScreenY: bay.screenY,
        stateProgress: 0,
        contrail: [],
        wake: [],
        wakeSpawnProgress: 0,
        lifeTime: SEAPLANE_FLIGHT_TIME_MIN + Math.random() * (SEAPLANE_FLIGHT_TIME_MAX - SEAPLANE_FLIGHT_TIME_MIN),
        taxiTime: SEAPLANE_TAXI_TIME_MIN + Math.random() * (SEAPLANE_TAXI_TIME_MAX - SEAPLANE_TAXI_TIME_MIN),
        color: SEAPLANE_COLORS[Math.floor(Math.random() * SEAPLANE_COLORS.length)],
      });
      
      // Set next spawn time
      seaplaneSpawnTimerRef.current = SEAPLANE_SPAWN_INTERVAL_MIN + Math.random() * (SEAPLANE_SPAWN_INTERVAL_MAX - SEAPLANE_SPAWN_INTERVAL_MIN);
    }

    // Update existing seaplanes
    const updatedSeaplanes: Seaplane[] = [];
    
    for (const seaplane of seaplanesRef.current) {
      // Update contrail particles when at altitude
      const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
      const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
      seaplane.contrail = seaplane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
        .filter(p => p.age < contrailMaxAge);
      
      // Update wake particles when on water
      const wakeMaxAge = isMobile ? 0.6 : WAKE_MAX_AGE;
      seaplane.wake = seaplane.wake
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / wakeMaxAge) }))
        .filter(p => p.age < wakeMaxAge);

      // Add contrail particles at high altitude
      if (seaplane.altitude > 0.7) {
        seaplane.stateProgress += delta;
        if (seaplane.stateProgress >= contrailSpawnInterval) {
          seaplane.stateProgress -= contrailSpawnInterval;
          // Single contrail particle - offset behind plane and down
          const behindOffset = 15; // Distance behind the plane
          const downOffset = 8; // Vertical offset down
          const contrailX = seaplane.x - Math.cos(seaplane.angle) * behindOffset;
          const contrailY = seaplane.y - Math.sin(seaplane.angle) * behindOffset + downOffset;
          seaplane.contrail.push({ x: contrailX, y: contrailY, age: 0, opacity: 1 });
        }
      }

      // Calculate next position
      let nextX = seaplane.x;
      let nextY = seaplane.y;

      switch (seaplane.state) {
        case 'taxiing_water': {
          // Taxi around on water like a boat
          seaplane.taxiTime -= delta;
          
          // Gentle random turning while taxiing
          if (Math.random() < 0.02) {
            seaplane.targetAngle = seaplane.angle + (Math.random() - 0.5) * Math.PI / 2;
          }
          
          // Smooth turning
          let angleDiff = seaplane.targetAngle - seaplane.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          seaplane.angle += angleDiff * Math.min(1, delta * 2);
          
          // Move forward slowly
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Check if next position is over water
          if (!isOverWaterCallback(nextX, nextY)) {
            // Turn around if about to leave water
            seaplane.targetAngle = seaplane.angle + Math.PI;
            nextX = seaplane.x;
            nextY = seaplane.y;
          }
          
          // Spawn wake particles
          const wakeSpawnInterval = isMobile ? 0.08 : WAKE_SPAWN_INTERVAL;
          seaplane.wakeSpawnProgress += delta;
          if (seaplane.wakeSpawnProgress >= wakeSpawnInterval) {
            seaplane.wakeSpawnProgress -= wakeSpawnInterval;
            const behindSeaplane = -8;
            seaplane.wake.push({
              x: seaplane.x + Math.cos(seaplane.angle) * behindSeaplane,
              y: seaplane.y + Math.sin(seaplane.angle) * behindSeaplane,
              age: 0,
              opacity: 1
            });
          }
          
          // Time to take off
          if (seaplane.taxiTime <= 0) {
            seaplane.state = 'taking_off';
            seaplane.speed = SEAPLANE_TAKEOFF_SPEED;
            // Pick a random takeoff direction
            seaplane.angle = Math.random() * Math.PI * 2;
            seaplane.targetAngle = seaplane.angle;
          }
          break;
        }
        
        case 'taking_off': {
          // Accelerate and climb (faster takeoff)
          seaplane.speed = Math.min(SEAPLANE_FLIGHT_SPEED_MAX, seaplane.speed + delta * 50);
          seaplane.altitude = Math.min(1, seaplane.altitude + delta * 0.6);
          
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Still spawn wake while on water
          if (seaplane.altitude < 0.3) {
            const wakeSpawnInterval = isMobile ? 0.04 : WAKE_SPAWN_INTERVAL / 2; // More frequent during takeoff
            seaplane.wakeSpawnProgress += delta;
            if (seaplane.wakeSpawnProgress >= wakeSpawnInterval) {
              seaplane.wakeSpawnProgress -= wakeSpawnInterval;
              const behindSeaplane = -10;
              seaplane.wake.push({
                x: seaplane.x + Math.cos(seaplane.angle) * behindSeaplane,
                y: seaplane.y + Math.sin(seaplane.angle) * behindSeaplane,
                age: 0,
                opacity: 1
              });
            }
          }
          
          // Transition to flying when at altitude
          if (seaplane.altitude >= 1) {
            seaplane.state = 'flying';
            seaplane.speed = SEAPLANE_FLIGHT_SPEED_MIN + Math.random() * (SEAPLANE_FLIGHT_SPEED_MAX - SEAPLANE_FLIGHT_SPEED_MIN);
          }
          break;
        }
        
        case 'flying': {
          // Fly at cruising altitude
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          seaplane.lifeTime -= delta;
          
          // Time to land - head back to bay
          if (seaplane.lifeTime <= 5) {
            const distToBay = Math.hypot(seaplane.x - seaplane.bayScreenX, seaplane.y - seaplane.bayScreenY);
            
            // Turn toward bay
            const angleToBay = Math.atan2(seaplane.bayScreenY - seaplane.y, seaplane.bayScreenX - seaplane.x);
            seaplane.angle = angleToBay;
            
            // Start landing approach when close to bay
            if (distToBay < 300) {
              seaplane.state = 'landing';
              seaplane.targetAltitude = 0;
            }
          } else if (seaplane.lifeTime <= 0) {
            // Out of time - despawn
            continue;
          }
          
          // Gentle course corrections while flying
          if (Math.random() < 0.01) {
            seaplane.angle += (Math.random() - 0.5) * 0.2;
          }
          break;
        }
        
        case 'landing': {
          // Descend and slow down
          seaplane.speed = Math.max(SEAPLANE_TAKEOFF_SPEED, seaplane.speed - delta * 15);
          seaplane.altitude = Math.max(0, seaplane.altitude - delta * 0.25);
          
          // Adjust angle toward bay center
          const angleToBay = Math.atan2(seaplane.bayScreenY - seaplane.y, seaplane.bayScreenX - seaplane.x);
          seaplane.angle = angleToBay;
          
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Transition to splashdown when very low
          if (seaplane.altitude <= 0.1) {
            seaplane.state = 'splashdown';
          }
          break;
        }
        
        case 'splashdown': {
          // Touch down on water and decelerate
          seaplane.altitude = 0;
          seaplane.speed = Math.max(0, seaplane.speed - delta * 25);
          
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Check if over water during splashdown
          if (!isOverWaterCallback(nextX, nextY)) {
            // Stop if not over water
            nextX = seaplane.x;
            nextY = seaplane.y;
            seaplane.speed = 0;
          }
          
          // Spawn wake during splashdown
          if (seaplane.speed > 5) {
            const wakeSpawnInterval = isMobile ? 0.04 : WAKE_SPAWN_INTERVAL / 2;
            seaplane.wakeSpawnProgress += delta;
            if (seaplane.wakeSpawnProgress >= wakeSpawnInterval) {
              seaplane.wakeSpawnProgress -= wakeSpawnInterval;
              const behindSeaplane = -10;
              seaplane.wake.push({
                x: seaplane.x + Math.cos(seaplane.angle) * behindSeaplane,
                y: seaplane.y + Math.sin(seaplane.angle) * behindSeaplane,
                age: 0,
                opacity: 1
              });
            }
          }
          
          // Remove seaplane when stopped
          if (seaplane.speed <= 1) {
            continue;
          }
          break;
        }
      }
      
      // Update position
      seaplane.x = nextX;
      seaplane.y = nextY;
      
      updatedSeaplanes.push(seaplane);
    }
    
    seaplanesRef.current = updatedSeaplanes;
  }, [worldStateRef, gridVersionRef, cachedPopulationRef, seaplanesRef, seaplaneIdRef, seaplaneSpawnTimerRef, findBaysCallback, isOverWaterCallback, isMobile]);

  return {
    updateSeaplanes,
    findBaysCallback,
  };
}
