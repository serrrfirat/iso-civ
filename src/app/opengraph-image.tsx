import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';
export const alt = 'ISOCITY — Metropolis Builder';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

// Game constants - scaled up for OG image
const TILE_WIDTH = 120;
const TILE_HEIGHT = 60;

// Game colors from drawing.ts
const GRASS_COLORS = {
  top: '#4a7c3f',
  left: '#3d6634',
  right: '#5a8f4f',
  stroke: '#2d4a26',
};

// Read image and convert to base64 data URL
async function getImageBase64(filename: string): Promise<string> {
  const imagePath = join(process.cwd(), 'public', 'assets', 'buildings', filename);
  const imageBuffer = await readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

// Isometric grid to screen coordinates
function gridToScreen(gridX: number, gridY: number, offsetX: number, offsetY: number) {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + offsetX,
    y: (gridX + gridY) * (TILE_HEIGHT / 2) + offsetY,
  };
}

// SVG path for isometric diamond tile
function getDiamondPath(x: number, y: number, w: number = TILE_WIDTH, h: number = TILE_HEIGHT): string {
  const top = { x: x + w / 2, y: y };
  const right = { x: x + w, y: y + h / 2 };
  const bottom = { x: x + w / 2, y: y + h };
  const left = { x: x, y: y + h / 2 };
  return `M ${top.x} ${top.y} L ${right.x} ${right.y} L ${bottom.x} ${bottom.y} L ${left.x} ${left.y} Z`;
}

export default async function Image() {
  // Load building images
  const [
    houseSmall,
    houseMedium,
    commercial,
    hospital,
    park,
    fireStation,
    shopSmall,
    trees,
    school,
    residential,
  ] = await Promise.all([
    getImageBase64('house_small.png'),
    getImageBase64('house_medium.png'),
    getImageBase64('commercial.png'),
    getImageBase64('hospital.png'),
    getImageBase64('park.png'),
    getImageBase64('fire_station.png'),
    getImageBase64('shop_small.png'),
    getImageBase64('trees.png'),
    getImageBase64('school.png'),
    getImageBase64('residential.png'),
  ]);

  // Center the grid in the image
  const OFFSET_X = 600;
  const OFFSET_Y = 180;

  // Grid size
  const GRID_SIZE = 5;

  // Generate grass tile positions
  const grassTiles: Array<{ x: number; y: number; screenX: number; screenY: number }> = [];
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      const { x: screenX, y: screenY } = gridToScreen(gx, gy, OFFSET_X, OFFSET_Y);
      grassTiles.push({ x: gx, y: gy, screenX, screenY });
    }
  }

  // Sort tiles by depth (back to front)
  grassTiles.sort((a, b) => (a.x + a.y) - (b.x + b.y));

  // Define building placements - scaled for larger tiles
  const buildings = [
    // Back row
    { gridX: 0, gridY: 0, src: trees, size: 170 },
    { gridX: 1, gridY: 0, src: houseSmall, size: 190 },
    { gridX: 2, gridY: 0, src: commercial, size: 260 },
    { gridX: 3, gridY: 0, src: houseMedium, size: 200 },
    { gridX: 4, gridY: 0, src: trees, size: 170 },
    
    // Row 1
    { gridX: 0, gridY: 1, src: park, size: 210 },
    { gridX: 1, gridY: 1, src: hospital, size: 240 },
    { gridX: 2, gridY: 1, src: school, size: 220 },
    { gridX: 3, gridY: 1, src: fireStation, size: 210 },
    { gridX: 4, gridY: 1, src: residential, size: 210 },
    
    // Row 2
    { gridX: 0, gridY: 2, src: houseMedium, size: 200 },
    { gridX: 1, gridY: 2, src: shopSmall, size: 180 },
    { gridX: 3, gridY: 2, src: houseSmall, size: 190 },
    { gridX: 4, gridY: 2, src: trees, size: 170 },
    
    // Front row
    { gridX: 0, gridY: 3, src: trees, size: 170 },
    { gridX: 4, gridY: 3, src: trees, size: 170 },
  ];

  // Sort buildings by depth
  buildings.sort((a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY));

  // Create SVG for grass tiles
  const svgWidth = 1200;
  const svgHeight = 630;
  
  let grassSvgPaths = '';
  for (const tile of grassTiles) {
    const path = getDiamondPath(tile.screenX, tile.screenY);
    // Fill
    grassSvgPaths += `<path d="${path}" fill="${GRASS_COLORS.top}" />`;
    // Stroke
    grassSvgPaths += `<path d="${path}" fill="none" stroke="${GRASS_COLORS.stroke}" stroke-width="0.5" />`;
  }

  const grassSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">${grassSvgPaths}</svg>`)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: 'linear-gradient(180deg, #1e293b 0%, #334155 50%, #475569 100%)',
        }}
      >
        {/* Grass tiles layer */}
        <img
          src={grassSvg}
          width={svgWidth}
          height={svgHeight}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />

        {/* Buildings */}
        {buildings.map((building, idx) => {
          const { x: screenX, y: screenY } = gridToScreen(building.gridX, building.gridY, OFFSET_X, OFFSET_Y);
          return (
            <img
              key={idx}
              src={building.src}
              width={building.size}
              height={building.size}
              style={{
                position: 'absolute',
                left: screenX + TILE_WIDTH / 2 - building.size / 2,
                top: screenY + TILE_HEIGHT / 2 - building.size * 0.75,
              }}
            />
          );
        })}
      </div>
    ),
    {
      ...size,
    }
  );
}
