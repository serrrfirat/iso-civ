#!/usr/bin/env node
/**
 * Generate sprite sheets using Nano Banana Pro (Gemini Image API)
 * then extract individual sprites using Python PIL.
 *
 * Uses the 6-row x 6-column sprite sheet format with red (#FF0000) background.
 * Each row = one asset with 4 directional isometric views + 2 special views.
 * We extract column 3 (SE-facing, the standard game view) for each row.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ── Load .env.local ──
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
}

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_API_KEY in .env.local");
  process.exit(1);
}

const SHEETS_DIR = path.join(process.cwd(), "public/sprites/sheets");
const OUTPUT_DIR = path.join(process.cwd(), "public/sprites/generated");
const EXTRACT_SCRIPT = path.join(
  process.env.HOME,
  ".claude/skills/isometric-sprite-sheets/scripts/extract_sprites.py"
);

// Gemini models to try (in order of preference)
const MODELS = [
  "gemini-3-pro-image-preview",     // Nano Banana Pro — best quality
  "gemini-2.5-flash-image",          // Nano Banana — fast fallback
];
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ── Sheet Definitions ──
// Each sheet has 6 rows. Each row = one sprite to generate.
const SHEETS = [
  {
    id: "ancient_warriors",
    names: ["warrior", "scout", "slinger", "spearman", "archer", "chariot"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with ANCIENT WARRIORS for my isometric civilization strategy game.

Each row should be ONE warrior unit. The first 4 items should be the unit isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front-facing portrait view. The 6th should be an action pose (attacking/fighting).

Row 1: Ancient warrior with bronze sword and round wooden shield, leather armor, simple helmet
Row 2: Scout - lightly armed explorer with a staff and leather satchel, no armor, animal skin cloak
Row 3: Slinger - primitive hunter with a leather sling, wearing animal skins, carrying a pouch of stones
Row 4: Spearman - hoplite soldier with a long spear, round bronze hoplon shield, bronze Corinthian helmet
Row 5: Archer - bowman with a longbow, quiver of arrows on back, light leather armor
Row 6: War chariot - two-wheeled ancient Egyptian-style chariot pulled by two horses with archer riding

ALL UNITS SHOULD BE HYPER REALISTIC, like miniature figurines for a strategy board game. NO SHADOWS. Each unit should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "classical_warriors",
    names: ["swordsman", "horseman", "catapult", "galley", "trireme", "crossbowman"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with CLASSICAL ERA MILITARY UNITS for my isometric civilization strategy game.

Each row should be ONE military unit. The first 4 items should be the unit isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front-facing portrait view. The 6th should be an action pose.

Row 1: Roman swordsman/legionary with gladius short sword, large rectangular scutum shield, iron lorica segmentata armor, red-plumed galea helmet
Row 2: Mounted horseman - cavalry soldier riding a brown horse, wearing leather armor, carrying a javelin and small round shield
Row 3: Catapult/onager - wooden siege catapult weapon on wheels with a throwing arm and counterweight, operated by soldiers
Row 4: Galley - ancient wooden rowing warship with a single square sail, oars visible on both sides, painted hull
Row 5: Trireme - Greek/Roman warship with three rows of oars, bronze naval ram at bow, large square sail
Row 6: Crossbowman - medieval soldier with a heavy crossbow, wearing padded gambeson armor and kettle helmet

ALL UNITS SHOULD BE HYPER REALISTIC, like miniature figurines for a strategy board game. NO SHADOWS. Each unit should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "medieval_warriors",
    names: ["pikeman", "longswordsman", "knight", "trebuchet", "missionary", "general"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with MEDIEVAL ERA MILITARY UNITS for my isometric civilization strategy game.

Each row should be ONE military unit. The first 4 items should be the unit isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front-facing portrait view. The 6th should be an action pose.

Row 1: Pikeman - medieval infantry soldier with a very long pike/halberd, wearing chain mail hauberk and kettle helmet
Row 2: Longswordsman - heavy infantry knight with a two-handed longsword, full plate armor with heraldic surcoat and great helm
Row 3: Mounted knight - fully armored knight on an armored destrier warhorse, carrying a lance and heater shield with coat of arms
Row 4: Trebuchet - large medieval counterweight siege trebuchet made of dark oak wood, with sling arm and heavy counterweight box
Row 5: Missionary/monk - religious figure in brown Franciscan robes, carrying a leather-bound holy book and wooden cross staff
Row 6: Great general - commanding officer on a majestic white horse, holding a battle standard/banner, wearing gold-decorated plate armor with red plume

ALL UNITS SHOULD BE HYPER REALISTIC, like miniature figurines for a strategy board game. NO SHADOWS. Each unit should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "civilian_misc",
    names: ["settler", "worker", "horse", "horses", "road", "mountain"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with CIVILIAN UNITS AND TERRAIN FEATURES for my isometric civilization strategy game.

Each row should be ONE asset. The first 4 items should be the asset isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front-facing view. The 6th should be a variant view.

Row 1: Settler - a civilian family group with a covered wagon pulled by an ox, carrying supplies and tools for founding a new city
Row 2: Worker/laborer - a civilian worker carrying a pickaxe and hammer, wearing simple brown linen clothing and a straw hat
Row 3: Single horse - a saddled brown riding horse standing, with leather saddle and bridle, muscular build
Row 4: Horse herd - a small group of 3-4 wild horses of different colors (brown, white, black) grazing together
Row 5: Cobblestone road - a section of paved stone road/path, flat on the ground, showing cobblestones with worn edges
Row 6: Mountain peak - a tall rocky mountain with snow-capped peak, grey stone with some green vegetation at base

ALL ASSETS SHOULD BE HYPER REALISTIC, like miniature figurines/terrain pieces for a strategy board game. NO SHADOWS. Each asset should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "ancient_buildings",
    names: ["palace", "monument", "shrine", "forge", "watermill", "stable"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with ANCIENT ERA BUILDINGS for my isometric civilization strategy game.

Each row should be ONE building. The first 4 items should be the building isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front entrance view. The 6th should be a night/lit version with warm interior glow.

Row 1: Grand palace - a magnificent ancient palace with white marble columns, golden domed roof, wide stone steps, decorative frieze
Row 2: Stone monument/obelisk - a tall carved stone obelisk or memorial pillar on an ornate stone pedestal base with inscriptions
Row 3: Sacred shrine - a small sacred shrine building with burning incense, stone altar, prayer flags, and ornate carvings
Row 4: Blacksmith forge - a stone workshop building with a tall chimney billowing smoke, iron anvil visible through open door, orange glow
Row 5: Water mill - a stone mill building with a large wooden water wheel on the side, thatched roof, grain sacks nearby
Row 6: Horse stable - a large wooden stable/barn for horses with hay bales, wooden fencing, and horse visible in stall

ALL BUILDINGS SHOULD BE HYPER REALISTIC, like miniature buildings for a strategy board game. NO SHADOWS. Each building should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "classical_buildings",
    names: ["amphitheater", "courthouse", "aqueduct", "colosseum", "harbor", "temple"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with CLASSICAL ERA BUILDINGS for my isometric civilization strategy game.

Each row should be ONE building. The first 4 items should be the building isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front entrance view. The 6th should be a night/lit version.

Row 1: Roman amphitheater - an open-air semicircular amphitheater with tiered stone seating, orchestra pit, and stage backdrop
Row 2: Courthouse - a classical Greco-Roman building with Corinthian columns, triangular pediment with Justice scales carved
Row 3: Roman aqueduct - a long stone arch aqueduct with water flowing on top channel, multiple repeating arches, weathered stone
Row 4: Colosseum - a miniature Roman Colosseum-style oval arena with four tiers of arched walls, open top showing sand floor
Row 5: Harbor/dock - a wooden harbor with stone quay, small wooden crane, stacked trade crates, and a moored merchant ship
Row 6: Greek temple - a classical temple with triangular pediment, six fluted Doric marble columns, stone steps, statue inside

ALL BUILDINGS SHOULD BE HYPER REALISTIC, like miniature buildings for a strategy board game. NO SHADOWS. Each building should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "medieval_buildings",
    names: ["university", "castle", "workshop", "bank", "monastery", "arsenal"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with MEDIEVAL ERA BUILDINGS for my isometric civilization strategy game.

Each row should be ONE building. The first 4 items should be the building isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front entrance view. The 6th should be a night/lit version.

Row 1: Medieval university - a large Gothic stone building with tall pointed arched windows, bell tower, open courtyard with scholars
Row 2: Castle keep - a fortified stone castle with crenellated battlements, round corner towers, gatehouse with portcullis, moat
Row 3: Workshop - a busy medieval workshop with gear/cog symbols, wooden scaffolding, workbenches, and tools hanging on walls
Row 4: Bank/treasury - a fortified stone building with iron-banded vault door, gold coin emblem on facade, ornate ironwork
Row 5: Monastery - a stone religious compound with chapel, cloister courtyard, bell tower, and herb garden
Row 6: Arsenal/armory - a heavily fortified stone military building with weapon racks visible, watchtower, military banners

ALL BUILDINGS SHOULD BE HYPER REALISTIC, like miniature buildings for a strategy board game. NO SHADOWS. Each building should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "wonders",
    names: ["great_library", "great_lighthouse", "colossus", "hanging_gardens", "hagia_sophia", "notre_dame"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with WORLD WONDERS for my isometric civilization strategy game.

Each row should be ONE wonder of the world. The first 4 items should be the wonder isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front-facing view. The 6th should be a night/illuminated version with dramatic lighting.

Row 1: Great Library of Alexandria - a grand ancient Egyptian library with towering scroll columns, papyrus scroll racks, large dome, hieroglyphic decorations
Row 2: Great Lighthouse (Pharos of Alexandria) - a tall multi-tiered ancient lighthouse with flame beacon at the top, white marble construction
Row 3: Colossus of Rhodes - a giant bronze statue of Helios straddling a harbor entrance, holding a torch aloft, green patina
Row 4: Hanging Gardens of Babylon - lush terraced gardens on massive stone zigzurat platforms with cascading waterfalls, exotic palms and flowers
Row 5: Hagia Sophia - a grand Byzantine basilica with massive central dome, four minarets, ornate mosaics, arched windows
Row 6: Notre Dame Cathedral - a Gothic masterpiece with twin bell towers, large rose window, flying buttresses, pointed spire

ALL WONDERS SHOULD BE HYPER REALISTIC AND GRAND, like detailed miniature architectural models. NO SHADOWS. Each wonder should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "resources_sacred",
    names: ["cathedral", "farm", "mine", "iron", "goldmine", "food_tile"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with BUILDINGS AND RESOURCE DEPOSITS for my isometric civilization strategy game.

Each row should be ONE asset. The first 4 items should be the asset isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a front-facing view. The 6th should be a variant.

Row 1: Gothic cathedral - a grand cathedral building with flying buttresses, tall stained glass windows, twin bell towers, rose window
Row 2: Farm - a small cultivated farm plot with rows of green crops, wooden fence, scarecrow, and a tiny barn
Row 3: Mine entrance - a hillside mine entrance with wooden support beams, mine cart on rails, pickaxes, and lantern
Row 4: Iron ore deposit - dark metallic rocks with reddish-brown iron ore veins visible, rough stone outcropping
Row 5: Gold mine - a mine with golden ore glinting in rock face, wooden sluice box, gold dust in water pan
Row 6: Food/wheat resource - a lush field of golden wheat with harvest baskets, sheaves of grain bundled

ALL ASSETS SHOULD BE HYPER REALISTIC, like miniature terrain pieces for a strategy board game. NO SHADOWS. Each asset should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
  {
    id: "resource_tiles",
    names: ["gold_tile", "horses_tile", "production_tile"],
    prompt: `Red background (#FF0000), solid uniform red, 6 rows, 6 columns - asset sheet with RESOURCE TILE ICONS for my isometric civilization strategy game.

Each row should be ONE resource icon. The first 4 items should be the resource isometrically projected 4 times for facing north west, north east, south east, and then south west. The 5th should be a top-down view. The 6th should be a close-up detailed version.

Row 1: Gold resource tile - a pile of gold coins and gold nuggets on a small terrain base, glittering and valuable
Row 2: Horses resource tile - two wild horses (one brown, one white) standing on a small grassy terrain patch, grazing
Row 3: Production/stone resource tile - a quarry with cut stone blocks and a mason's tools on a small terrain base

ROWS 4-6 SHOULD BE LEFT EMPTY (just red background).

ALL RESOURCE ICONS SHOULD BE HYPER REALISTIC, like miniature terrain pieces for a strategy board game. NO SHADOWS. Each resource should be clearly visible, centered in its grid cell, and NOT touching the edges. The background MUST be solid red (#FF0000). Full size, 2048x2048 square.`,
  },
];

// ── API Call ──
async function generateSheet(apiKey, prompt, outputPath) {
  for (const model of MODELS) {
    const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "2K",
        },
      },
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`  [${model}] attempt ${attempt}/3...`);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120_000),
        });

        if (res.status === 404) {
          console.log(`  Model ${model} not found, trying next...`);
          break;
        }
        if (!res.ok) {
          const text = await res.text();
          console.log(`  HTTP ${res.status}: ${text.slice(0, 200)}`);
          await sleep(3000 * attempt);
          continue;
        }

        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          const d = p.inlineData;
          if (d?.mimeType?.startsWith("image/")) {
            const buf = Buffer.from(d.data, "base64");
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, buf);
            console.log(`  Saved ${outputPath} (${(buf.length / 1024).toFixed(0)} KB)`);
            return true;
          }
        }
        console.log(`  No image in response`);
      } catch (err) {
        console.log(`  Error: ${err.message}`);
      }
      if (attempt < 3) await sleep(3000 * attempt);
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Extract sprites from a sheet using Python PIL ──
function extractSprites(sheetPath, names, outputDir) {
  const nameStr = names.join(",");
  // Use the skill's extraction script if available, otherwise inline Python
  const pythonCode = `
import sys
from PIL import Image
import os

COLS = 6
ROWS = 6

def remove_red_bg(img):
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    visited = set()
    def is_red(r, g, b):
        return r > 160 and g < 80 and b < 80 and (r - g) > 80
    corners = [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]
    queue = list(corners)
    for c in corners:
        visited.add(c)
    while queue:
        x, y = queue.pop(0)
        r, g, b, a = pixels[x, y]
        if is_red(r, g, b):
            pixels[x, y] = (0, 0, 0, 0)
            for nx, ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if 0 <= nx < w and 0 <= ny < h and (nx,ny) not in visited:
                    visited.add((nx,ny))
                    queue.append((nx,ny))
        else:
            ratio = r / max(1, (r+g+b)/3)
            if ratio > 1.5 and g < 100 and b < 100:
                alpha = max(0, min(255, int(255*(1-(ratio-1.5)/1.0))))
                pixels[x,y] = (r,g,b,alpha)
    return img

def trim_and_resize(img, size):
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    if w > size or h > size:
        ratio = min(size/w, size/h)
        img = img.resize((max(1,int(w*ratio)), max(1,int(h*ratio))), Image.LANCZOS)
    return img

sheet_path = sys.argv[1]
output_dir = sys.argv[2]
names = sys.argv[3].split(",")
target_col = 3  # SW facing (0-indexed) - standard isometric game camera view

os.makedirs(output_dir, exist_ok=True)
sheet = Image.open(sheet_path)
cw, ch = sheet.size[0]//COLS, sheet.size[1]//ROWS

for row, name in enumerate(names):
    if not name.strip():
        continue
    out = os.path.join(output_dir, f"{name.strip()}.png")
    cell = sheet.crop((target_col*cw, row*ch, (target_col+1)*cw, (row+1)*ch))
    cell = remove_red_bg(cell)
    cell = trim_and_resize(cell, 256)
    cell.save(out, "PNG", optimize=True)
    print(f"  [ok] {name.strip()}.png ({cell.size[0]}x{cell.size[1]})")
`;

  const tmpScript = path.join(SHEETS_DIR, "_extract.py");
  fs.writeFileSync(tmpScript, pythonCode);
  try {
    const result = execSync(
      `python3 "${tmpScript}" "${sheetPath}" "${outputDir}" "${nameStr}"`,
      { encoding: "utf8", timeout: 60_000 }
    );
    console.log(result);
  } catch (err) {
    console.error(`  Extraction error: ${err.message}`);
  }
}

// ── Main ──
async function main() {
  console.log("=== Sprite Sheet Generation for iso-civ ===");
  console.log(`Sheets to generate: ${SHEETS.length}`);
  console.log(`Total sprites: ${SHEETS.reduce((s, sh) => s + sh.names.length, 0)}`);
  console.log("");

  fs.mkdirSync(SHEETS_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Backup existing sprites
  const backupDir = path.join(process.cwd(), "public/sprites/generated_backup");
  if (!fs.existsSync(backupDir)) {
    console.log("Backing up existing sprites...");
    fs.mkdirSync(backupDir, { recursive: true });
    for (const f of fs.readdirSync(OUTPUT_DIR)) {
      if (f.endsWith(".png")) {
        fs.copyFileSync(path.join(OUTPUT_DIR, f), path.join(backupDir, f));
      }
    }
    console.log(`  Backed up to ${backupDir}\n`);
  }

  let generated = 0;
  let failed = 0;

  for (const sheet of SHEETS) {
    const sheetPath = path.join(SHEETS_DIR, `${sheet.id}.png`);
    console.log(`\n── Sheet: ${sheet.id} (${sheet.names.join(", ")}) ──`);

    // Skip if sheet already generated
    if (fs.existsSync(sheetPath)) {
      console.log(`  Sheet already exists, extracting sprites...`);
    } else {
      const ok = await generateSheet(API_KEY, sheet.prompt, sheetPath);
      if (!ok) {
        console.log(`  FAILED to generate sheet ${sheet.id}`);
        failed += sheet.names.length;
        continue;
      }
      // Rate limit delay between sheets
      await sleep(3000);
    }

    // Extract individual sprites
    extractSprites(sheetPath, sheet.names, OUTPUT_DIR);
    generated += sheet.names.length;
  }

  // Cleanup temp extraction script
  const tmpScript = path.join(SHEETS_DIR, "_extract.py");
  if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);

  console.log(`\n=== Done ===`);
  console.log(`  Generated: ${generated} sprites from ${SHEETS.length} sheets`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Sheets saved in: ${SHEETS_DIR}`);
  console.log(`  Sprites saved in: ${OUTPUT_DIR}`);
  console.log(`  Backup at: ${path.join(process.cwd(), "public/sprites/generated_backup")}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
