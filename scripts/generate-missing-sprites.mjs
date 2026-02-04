import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_API_KEY environment variable.");
  process.exit(1);
}

const OUTPUT_DIR = path.join(PROJECT_ROOT, "public/sprites/generated");

// Style reference shared across all prompts for consistency
const STYLE =
  "Clean pixel art style, isometric perspective facing south-east, " +
  "suitable for a civilization strategy game like Civilization. " +
  "On a transparent/blank background with no ground plane. " +
  "Single centered sprite, no duplicates, no text, no UI elements.";

const SPRITES = [
  // Resource icons (small items, ~32x32 feel but generated at higher res)
  {
    name: "horses",
    prompt:
      `A pixel art isometric horse sprite. A single brown horse standing alert, ` +
      `with saddle and bridle, muscular build. ${STYLE}`,
  },
  // Improvement sprites (placed on tiles)
  {
    name: "farm",
    prompt:
      `A pixel art isometric small farm plot sprite. Golden wheat field with neat rows ` +
      `and a tiny wooden fence around it. ${STYLE}`,
  },
  {
    name: "mine",
    prompt:
      `A pixel art isometric mine entrance sprite. A small cave opening in rock ` +
      `with wooden support beams, a minecart with ore, and a pickaxe leaning against the wall. ${STYLE}`,
  },
  {
    name: "road",
    prompt:
      `A pixel art isometric cobblestone road segment sprite. A short section of ` +
      `stone-paved road with worn edges, suitable for tiling. ${STYLE}`,
  },
  // Mountain terrain decoration
  {
    name: "mountain",
    prompt:
      `A pixel art isometric mountain peak sprite. A tall rocky mountain with ` +
      `snow-capped peak, gray and brown rocky faces, suitable as terrain decoration. ${STYLE}`,
  },
];

async function generateSprite(sprite, forceRegenerate = false) {
  const model = "imagen-4.0-generate-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;
  const outputPath = path.join(OUTPUT_DIR, `${sprite.name}.png`);

  if (!forceRegenerate && fs.existsSync(outputPath)) {
    console.log(`[${sprite.name}] Already exists, skipping (use --force to regenerate)`);
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
      console.error(`[${sprite.name}] HTTP ${res.status}: ${JSON.stringify(data.error?.message || data).slice(0, 300)}`);
      return false;
    }

    if (data.predictions && data.predictions.length > 0) {
      const b64 = data.predictions[0].bytesBase64Encoded;
      if (b64) {
        const buffer = Buffer.from(b64, "base64");
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buffer);
        console.log(`[${sprite.name}] Saved to ${outputPath} (${buffer.length} bytes)`);
        return true;
      }
    }

    console.error(`[${sprite.name}] Unexpected response: ${JSON.stringify(data).slice(0, 300)}`);
    return false;
  } catch (err) {
    console.error(`[${sprite.name}] Error: ${err.message}`);
    return false;
  }
}

async function main() {
  const forceRegenerate = process.argv.includes("--force");
  // Allow filtering by name: node generate-missing-sprites.mjs horses farm
  const filterNames = process.argv.slice(2).filter(a => !a.startsWith("--"));

  const sprites = filterNames.length > 0
    ? SPRITES.filter(s => filterNames.includes(s.name))
    : SPRITES;

  if (sprites.length === 0) {
    console.error("No matching sprites found. Available:", SPRITES.map(s => s.name).join(", "));
    process.exit(1);
  }

  console.log(`=== Generating ${sprites.length} sprites (Imagen 4) ===\n`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = await Promise.allSettled(sprites.map(s => generateSprite(s, forceRegenerate)));

  console.log("\n=== Results ===");
  results.forEach((r, i) => {
    const status = r.status === "fulfilled" && r.value ? "OK" : "FAILED";
    console.log(`  ${sprites[i].name}: ${status}`);
  });
}

main();
