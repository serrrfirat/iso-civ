import fs from "node:fs";
import path from "node:path";

const API_KEY = "REDACTED_API_KEY";
const OUTPUT_DIR = "/Users/firatsertgoz/Documents/agent-civ/public/sprites/generated";

const SPRITES = [
  {
    name: "warrior",
    prompt:
      "A pixel art isometric warrior soldier sprite on a transparent background. " +
      "Roman legionary style with red cape, bronze helmet, shield and sword. " +
      "Facing south-east in isometric view. Clean pixel art style, 64x64 pixels, " +
      "suitable for a civilization strategy game. No background, transparent.",
  },
  {
    name: "archer",
    prompt:
      "A pixel art isometric archer sprite on a transparent background. " +
      "Medieval archer with a longbow, wearing a green hooded cloak. " +
      "Facing south-east in isometric view. Clean pixel art style, 64x64 pixels, " +
      "suitable for a civilization strategy game. No background, transparent.",
  },
  {
    name: "scout",
    prompt:
      "A pixel art isometric scout/explorer sprite on a transparent background. " +
      "Light-armored scout with a torch and leather armor, wearing a brown traveling cloak. " +
      "Facing south-east in isometric view. Clean pixel art style, 64x64 pixels, " +
      "suitable for a civilization strategy game. No background, transparent.",
  },
  {
    name: "settler",
    prompt:
      "A pixel art isometric settler/colonist sprite on a transparent background. " +
      "A covered wagon with a person walking beside it, pioneer style. " +
      "Facing south-east in isometric view. Clean pixel art style, 64x64 pixels, " +
      "suitable for a civilization strategy game. No background, transparent.",
  },
];

async function generateSprite(sprite) {
  const model = "imagen-4.0-generate-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;
  const outputPath = path.join(OUTPUT_DIR, `${sprite.name}.png`);

  // Skip if already exists
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
        console.log(`[${sprite.name}] Saved to ${outputPath} (${buffer.length} bytes)`);
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
  console.log("=== Batch Sprite Generation (Imagen 4) ===\n");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Generate all sprites in parallel
  const results = await Promise.allSettled(SPRITES.map((s) => generateSprite(s)));

  console.log("\n=== Results ===");
  results.forEach((r, i) => {
    const status = r.status === "fulfilled" && r.value ? "OK" : "FAILED";
    console.log(`  ${SPRITES[i].name}: ${status}`);
  });
}

main();
