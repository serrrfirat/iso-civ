import fs from "node:fs";
import path from "node:path";

const API_KEY = "REDACTED_API_KEY";
const OUTPUT_DIR = "/Users/firatsertgoz/Documents/agent-civ/public/sprites/generated";

const SPRITES = [
  {
    name: "horses_tile",
    prompt:
      "An isometric diamond-shaped grass tile with two small brown horses grazing on it. " +
      "The tile is a 64x64 pixel art isometric diamond (rhombus shape) with green grass. " +
      "The horses are small and integrated into the tile, not floating above it. " +
      "Pixel art style, transparent background outside the diamond. " +
      "Top-down isometric view like a civilization strategy game tile.",
  },
  {
    name: "food_tile",
    prompt:
      "An isometric diamond-shaped grass tile with a small wheat farm on it. " +
      "The tile is a 64x64 pixel art isometric diamond (rhombus shape) with green grass " +
      "and golden wheat crops growing on it in neat rows. " +
      "Pixel art style, transparent background outside the diamond. " +
      "Top-down isometric view like a civilization strategy game tile.",
  },
  {
    name: "gold_tile",
    prompt:
      "An isometric diamond-shaped grass tile with a small gold mine entrance on it. " +
      "The tile is a 64x64 pixel art isometric diamond (rhombus shape) with green grass " +
      "and a tiny mine shaft entrance with gold nuggets visible nearby. " +
      "Pixel art style, transparent background outside the diamond. " +
      "Top-down isometric view like a civilization strategy game tile.",
  },
  {
    name: "production_tile",
    prompt:
      "An isometric diamond-shaped grass tile with a small stone quarry on it. " +
      "The tile is a 64x64 pixel art isometric diamond (rhombus shape) with green grass " +
      "and grey stone blocks being quarried, with a tiny pickaxe. " +
      "Pixel art style, transparent background outside the diamond. " +
      "Top-down isometric view like a civilization strategy game tile.",
  },
];

async function generateSprite(sprite) {
  const model = "imagen-4.0-generate-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;
  const outputPath = path.join(OUTPUT_DIR, `${sprite.name}.png`);

  if (fs.existsSync(outputPath)) {
    console.log(`[${sprite.name}] Already exists, skipping`);
    return true;
  }

  console.log(`[${sprite.name}] Generating...`);

  const body = {
    instances: [{ prompt: sprite.prompt }],
    parameters: { sampleCount: 1 },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.log(`[${sprite.name}] HTTP ${res.status}: ${JSON.stringify(data.error?.message || data).slice(0, 300)}`);
      return false;
    }

    if (data.predictions && data.predictions.length > 0) {
      const b64 = data.predictions[0].bytesBase64Encoded;
      if (b64) {
        const buffer = Buffer.from(b64, "base64");
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buffer);
        console.log(`[${sprite.name}] Saved (${buffer.length} bytes)`);
        return true;
      }
    }

    console.log(`[${sprite.name}] Unexpected response: ${JSON.stringify(data).slice(0, 300)}`);
    return false;
  } catch (err) {
    console.log(`[${sprite.name}] Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("=== Resource Tile Generation (Imagen 4) ===\n");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = await Promise.allSettled(SPRITES.map((s) => generateSprite(s)));

  console.log("\n=== Results ===");
  results.forEach((r, i) => {
    const status = r.status === "fulfilled" && r.value ? "OK" : "FAILED";
    console.log(`  ${SPRITES[i].name}: ${status}`);
  });
}

main();
