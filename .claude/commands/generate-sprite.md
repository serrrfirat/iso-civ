# Generate Isometric Game Sprite

Generate a new AI sprite for the iso-civ game using Google Imagen 4.0 API.

## Usage

Provide the sprite name and optionally a style/description. If no style is specified, derive the art style from the existing repository sprites.

**Arguments:** `$ARGUMENTS` (sprite name and optional style description)

## Instructions

1. **Parse the arguments**: Extract the sprite name (required) and optional style description from `$ARGUMENTS`.

2. **Determine the art style**:
   - If a style was provided, use it.
   - If no style was provided, use the repository's standard style:
     - **Units/Characters**: "Clean pixel art style, isometric perspective facing south-east, suitable for a civilization strategy game like Civilization. On a transparent/blank background with no ground plane. Single centered sprite, no duplicates, no text, no UI elements."
     - **Buildings/Structures**: "Isometric pixel art building/structure, south-east facing, detailed but clean, suitable for a civilization strategy game. On a transparent/blank background, no ground plane."
     - **Resources/Items**: "Pixel art isometric item/resource, detailed, clean style, suitable for a civilization strategy game. On a transparent/blank background, single item centered."
     - **Terrain decorations**: "Pixel art isometric terrain feature, suitable as terrain decoration for a civilization strategy game. On a transparent/blank background."

3. **Check if sprite already exists** at `public/sprites/generated/<name>.png`. If it does, ask the user whether to overwrite.

4. **Read the API key** from `.env.local` (look for `GOOGLE_API_KEY=`). If not found, tell the user to set `GOOGLE_API_KEY` in `.env.local`.

5. **Generate the sprite** by running:
   ```bash
   GOOGLE_API_KEY=<key> node -e "
   const fs = require('fs');
   const path = require('path');
   async function main() {
     const API_KEY = process.env.GOOGLE_API_KEY;
     const name = '<SPRITE_NAME>';
     const prompt = '<FULL_PROMPT>';
     const model = 'imagen-4.0-generate-001';
     const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:predict?key=\${API_KEY}\`;
     const outputPath = path.join('public/sprites/generated', name + '.png');

     console.log('Generating sprite:', name);
     const res = await fetch(url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
     });
     const data = await res.json();
     if (!res.ok) { console.error('API error:', data.error?.message || JSON.stringify(data)); process.exit(1); }
     if (data.predictions?.[0]?.bytesBase64Encoded) {
       const buffer = Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
       fs.mkdirSync(path.dirname(outputPath), { recursive: true });
       fs.writeFileSync(outputPath, buffer);
       console.log('Saved to', outputPath, '(' + buffer.length + ' bytes)');
     } else {
       console.error('No image in response');
       process.exit(1);
     }
   }
   main();
   "
   ```

6. **Register the sprite in the codebase**:
   - Add the sprite path to the appropriate constant in `src/lib/civ/spriteLoader.ts`:
     - Units go in `UNIT_SPRITES`
     - Resources go in `RESOURCE_SPRITES`
     - Improvements go in `IMPROVEMENT_SPRITES`
     - Buildings go in `BUILDING_SPRITES`
   - Add the path to `SPRITES_NEEDING_BG_REMOVAL` if it's an AI-generated sprite (they need background removal since Imagen outputs RGB without alpha)
   - Make sure it's included in `preloadAll()` paths

7. **Wire up rendering** if the sprite replaces a programmatic fallback:
   - For units: check `src/components/civ/UnitRenderer.ts`
   - For terrain: check `src/components/civ/TerrainRenderer.ts`
   - For resources: check `drawResourceIcon()` in TerrainRenderer

8. **Verify** the dev server compiles without errors.

## Example invocations

- `/generate-sprite catapult` - Generates a catapult unit sprite using the repo's default pixel art style
- `/generate-sprite temple Ancient Greek marble temple with columns` - Generates a temple building with a specific style description
- `/generate-sprite iron_ore` - Generates an iron ore resource sprite
