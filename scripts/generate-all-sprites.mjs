import fs from "node:fs";
import path from "node:path";

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_API_KEY. Set it in .env.local");
  process.exit(1);
}

const OUTPUT_DIR = path.join(process.cwd(), "public/sprites/generated");

const BASE_STYLE =
  "Pixel art isometric sprite on a transparent/white background. " +
  "Facing south-east in isometric view. Clean pixel art style, 64x64 pixels, " +
  "suitable for a civilization strategy game.";

// ── New unit sprites (not already generated) ──
const UNIT_SPRITES = [
  {
    name: "slinger",
    prompt: `A pixel art isometric slinger warrior sprite. Primitive hunter with a leather sling, wearing animal skins and carrying a pouch of stones. ${BASE_STYLE}`,
  },
  {
    name: "worker",
    prompt: `A pixel art isometric worker/laborer sprite. A civilian worker carrying tools (pickaxe and hammer) with simple brown clothing. ${BASE_STYLE}`,
  },
  {
    name: "spearman",
    prompt: `A pixel art isometric spearman soldier sprite. Ancient warrior with a long spear, round bronze shield, and bronze helmet. ${BASE_STYLE}`,
  },
  {
    name: "chariot",
    prompt: `A pixel art isometric war chariot sprite. A two-wheeled ancient chariot pulled by two horses, with an archer riding in it. ${BASE_STYLE}`,
  },
  {
    name: "galley",
    prompt: `A pixel art isometric ancient galley ship sprite. A wooden rowing ship with a single sail and oars visible on the sides. ${BASE_STYLE}`,
  },
  {
    name: "catapult",
    prompt: `A pixel art isometric catapult siege weapon sprite. A wooden siege catapult/onager on wheels with a throwing arm. ${BASE_STYLE}`,
  },
  {
    name: "swordsman",
    prompt: `A pixel art isometric swordsman soldier sprite. Roman legionary-style warrior with a gladius sword, large rectangular shield (scutum), and iron helmet with red plume. ${BASE_STYLE}`,
  },
  {
    name: "horseman",
    prompt: `A pixel art isometric mounted horseman sprite. A cavalry soldier riding a brown horse, wearing leather armor and carrying a javelin. ${BASE_STYLE}`,
  },
  {
    name: "trireme",
    prompt: `A pixel art isometric trireme warship sprite. An ancient Greek/Roman warship with three rows of oars, a bronze ram, and a sail. ${BASE_STYLE}`,
  },
  {
    name: "pikeman",
    prompt: `A pixel art isometric pikeman soldier sprite. Medieval infantry soldier with a very long pike/spear, wearing chain mail and a kettle helmet. ${BASE_STYLE}`,
  },
  {
    name: "crossbowman",
    prompt: `A pixel art isometric crossbowman soldier sprite. Medieval soldier with a heavy crossbow, wearing padded armor and a flat cap. ${BASE_STYLE}`,
  },
  {
    name: "longswordsman",
    prompt: `A pixel art isometric longswordsman knight sprite. Medieval heavy infantry with a two-handed longsword, plate armor, and heraldic surcoat. ${BASE_STYLE}`,
  },
  {
    name: "knight",
    prompt: `A pixel art isometric mounted knight sprite. A fully armored knight on an armored horse (destrier), carrying a lance and shield. ${BASE_STYLE}`,
  },
  {
    name: "trebuchet",
    prompt: `A pixel art isometric trebuchet siege weapon sprite. A large medieval counterweight trebuchet made of wood, with a sling and counterweight box. ${BASE_STYLE}`,
  },
  {
    name: "missionary",
    prompt: `A pixel art isometric missionary/monk sprite. A religious figure in brown robes carrying a holy book and a cross staff. ${BASE_STYLE}`,
  },
  {
    name: "general",
    prompt: `A pixel art isometric great general sprite. A commanding officer on a white horse with a banner/flag, wearing decorated armor and a plumed helmet. ${BASE_STYLE}`,
  },
];

// ── New building sprites ──
const BUILDING_SPRITES = [
  {
    name: "palace",
    prompt: `A pixel art isometric palace building sprite. A grand ancient palace with marble columns, golden dome, and steps. ${BASE_STYLE}`,
  },
  {
    name: "monument",
    prompt: `A pixel art isometric stone monument/obelisk sprite. A tall stone obelisk or memorial pillar on a stone base. ${BASE_STYLE}`,
  },
  {
    name: "shrine",
    prompt: `A pixel art isometric small shrine building sprite. A small sacred shrine with incense, stone altar, and prayer flags. ${BASE_STYLE}`,
  },
  {
    name: "watermill",
    prompt: `A pixel art isometric water mill building sprite. A stone building with a large wooden water wheel on the side. ${BASE_STYLE}`,
  },
  {
    name: "stable",
    prompt: `A pixel art isometric stable building sprite. A wooden stable/barn for horses with hay and fencing. ${BASE_STYLE}`,
  },
  {
    name: "amphitheater",
    prompt: `A pixel art isometric amphitheater building sprite. An ancient Roman-style open-air amphitheater with tiered stone seating. ${BASE_STYLE}`,
  },
  {
    name: "courthouse",
    prompt: `A pixel art isometric courthouse building sprite. A classical building with columns and a balanced scale symbol on the pediment. ${BASE_STYLE}`,
  },
  {
    name: "aqueduct",
    prompt: `A pixel art isometric Roman aqueduct sprite. A stone arch aqueduct with water flowing on top, multiple arches. ${BASE_STYLE}`,
  },
  {
    name: "colosseum",
    prompt: `A pixel art isometric colosseum building sprite. A miniature Roman Colosseum-style arena with arched walls. ${BASE_STYLE}`,
  },
  {
    name: "forge",
    prompt: `A pixel art isometric blacksmith forge building sprite. A stone workshop with a chimney, anvil visible, and glowing orange light from within. ${BASE_STYLE}`,
  },
  {
    name: "harbor",
    prompt: `A pixel art isometric harbor/dock building sprite. A wooden dock with a small crane, crates, and moored boats. ${BASE_STYLE}`,
  },
  {
    name: "temple",
    prompt: `A pixel art isometric ancient temple building sprite. A Greek-style temple with a triangular pediment and six marble columns. ${BASE_STYLE}`,
  },
  {
    name: "university",
    prompt: `A pixel art isometric medieval university building sprite. A large stone building with Gothic windows, a bell tower, and an open book symbol. ${BASE_STYLE}`,
  },
  {
    name: "castle",
    prompt: `A pixel art isometric medieval castle/keep building sprite. A stone castle with crenellated walls, towers, and a gate with drawbridge. ${BASE_STYLE}`,
  },
  {
    name: "workshop",
    prompt: `A pixel art isometric medieval workshop building sprite. A busy workshop with gear/cog symbols, wooden scaffolding, and tools. ${BASE_STYLE}`,
  },
  {
    name: "bank",
    prompt: `A pixel art isometric medieval bank building sprite. A stone building with a vault door, gold coin symbol on front. ${BASE_STYLE}`,
  },
  {
    name: "monastery",
    prompt: `A pixel art isometric medieval monastery building sprite. A stone religious compound with a chapel, bell tower, and garden. ${BASE_STYLE}`,
  },
  {
    name: "arsenal",
    prompt: `A pixel art isometric military arsenal building sprite. A fortified stone building with weapon racks visible and a military banner. ${BASE_STYLE}`,
  },
  {
    name: "cathedral",
    prompt: `A pixel art isometric Gothic cathedral building sprite. A grand cathedral with flying buttresses, stained glass windows, and twin towers. ${BASE_STYLE}`,
  },
  {
    name: "great_lighthouse",
    prompt: `A pixel art isometric wonder: Great Lighthouse sprite. A tall ancient lighthouse (like Pharos of Alexandria) with a flame at the top. ${BASE_STYLE}`,
  },
  {
    name: "great_library",
    prompt: `A pixel art isometric wonder: Great Library sprite. A grand ancient library building with scroll racks, columns, and a dome. ${BASE_STYLE}`,
  },
  {
    name: "colossus",
    prompt: `A pixel art isometric wonder: Colossus statue sprite. A giant bronze statue straddling a harbor entrance, like the Colossus of Rhodes. ${BASE_STYLE}`,
  },
  {
    name: "hanging_gardens",
    prompt: `A pixel art isometric wonder: Hanging Gardens sprite. Lush terraced gardens on stone platforms with waterfalls and exotic plants. ${BASE_STYLE}`,
  },
  {
    name: "hagia_sophia",
    prompt: `A pixel art isometric wonder: Hagia Sophia sprite. A grand domed building with minarets and Byzantine architecture. ${BASE_STYLE}`,
  },
  {
    name: "notre_dame",
    prompt: `A pixel art isometric wonder: Notre Dame cathedral sprite. A Gothic cathedral with twin towers, rose window, and flying buttresses. ${BASE_STYLE}`,
  },
  // Resource icon
  {
    name: "iron",
    prompt: `A pixel art isometric iron ore deposit sprite. Dark metallic rocks with reddish-brown iron ore visible, on a small terrain patch. ${BASE_STYLE}`,
  },
];

const ALL_SPRITES = [...UNIT_SPRITES, ...BUILDING_SPRITES];

async function generateSprite(sprite) {
  const model = "imagen-4.0-generate-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;
  const outputPath = path.join(OUTPUT_DIR, `${sprite.name}.png`);

  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    console.log(`  [${sprite.name}] Already exists, skipping`);
    return true;
  }

  console.log(`  [${sprite.name}] Generating...`);

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
      console.log(
        `  [${sprite.name}] HTTP ${res.status}: ${JSON.stringify(data.error?.message || data).slice(0, 300)}`
      );
      return false;
    }

    if (data.predictions && data.predictions.length > 0) {
      const b64 = data.predictions[0].bytesBase64Encoded;
      if (b64) {
        const buffer = Buffer.from(b64, "base64");
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buffer);
        console.log(`  [${sprite.name}] Saved (${buffer.length} bytes)`);
        return true;
      }
    }

    console.log(
      `  [${sprite.name}] Unexpected response: ${JSON.stringify(data).slice(0, 300)}`
    );
    return false;
  } catch (err) {
    console.log(`  [${sprite.name}] Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("=== Batch Sprite Generation for Ruleset Expansion ===");
  console.log(`Total sprites to check: ${ALL_SPRITES.length}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Process in batches of 4 to avoid rate limiting
  const BATCH_SIZE = 4;
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < ALL_SPRITES.length; i += BATCH_SIZE) {
    const batch = ALL_SPRITES.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((s) => generateSprite(s))
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value === true) {
        // Check if it was skipped or generated
        generated++;
      } else {
        failed++;
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < ALL_SPRITES.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`  Processed: ${generated + failed}`);
  console.log(`  Failed: ${failed}`);
}

main();
