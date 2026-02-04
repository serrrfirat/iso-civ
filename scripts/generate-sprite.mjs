import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_API_KEY environment variable. Set it in .env or export it.");
  process.exit(1);
}
const OUTPUT_PATH = "/Users/firatsertgoz/Documents/agent-civ/public/sprites/generated/horse.png";

const PROMPT =
  "A 64x64 pixel art isometric horse sprite on a transparent background. " +
  "The horse should be brown, facing right, in a simple pixel art style suitable " +
  "for a civilization strategy game. Clean edges, no antialiasing, pixel art aesthetic.";

// --- Strategy 1: Gemini 2.5 Flash (native image generation) ---
async function tryGeminiFlashImage() {
  const model = "gemini-2.5-flash-preview-04-17";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  console.log(`[Strategy 1] Trying model: ${model}`);
  console.log(`  URL: ${url.replace(API_KEY, "***")}`);

  const body = {
    contents: [{ parts: [{ text: PROMPT }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.log(`  HTTP ${res.status}: ${JSON.stringify(data.error?.message || data).slice(0, 300)}`);
    return null;
  }

  return extractImage(data, "Strategy 1");
}

// --- Strategy 2: Gemini 2.0 Flash image generation preview ---
async function tryGemini2FlashImage() {
  const model = "gemini-2.0-flash-preview-image-generation";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  console.log(`[Strategy 2] Trying model: ${model}`);
  console.log(`  URL: ${url.replace(API_KEY, "***")}`);

  const body = {
    contents: [{ parts: [{ text: PROMPT }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.log(`  HTTP ${res.status}: ${JSON.stringify(data.error?.message || data).slice(0, 300)}`);
    return null;
  }

  return extractImage(data, "Strategy 2");
}

// --- Strategy 3: Imagen 4 (dedicated image generation) ---
async function tryImagen() {
  const model = "imagen-4.0-generate-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;

  console.log(`[Strategy 3] Trying model: ${model}`);
  console.log(`  URL: ${url.replace(API_KEY, "***")}`);

  const body = {
    instances: [{ prompt: PROMPT }],
    parameters: {
      sampleCount: 1,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.log(`  HTTP ${res.status}: ${JSON.stringify(data.error?.message || data).slice(0, 300)}`);
    return null;
  }

  // Imagen response format: predictions[].bytesBase64Encoded
  if (data.predictions && data.predictions.length > 0) {
    const b64 = data.predictions[0].bytesBase64Encoded;
    if (b64) {
      console.log(`  [Strategy 3] Got image from Imagen (${b64.length} base64 chars)`);
      return Buffer.from(b64, "base64");
    }
  }

  console.log(`  [Strategy 3] Unexpected response structure: ${JSON.stringify(data).slice(0, 500)}`);
  return null;
}

// --- Strategy 4: Gemini 2.5 Flash (image model variant) ---
async function tryGemini25FlashImage() {
  const model = "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  console.log(`[Strategy 4] Trying model: ${model}`);
  console.log(`  URL: ${url.replace(API_KEY, "***")}`);

  const body = {
    contents: [{ parts: [{ text: PROMPT }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.log(`  HTTP ${res.status}: ${JSON.stringify(data.error?.message || data).slice(0, 300)}`);
    return null;
  }

  return extractImage(data, "Strategy 4");
}

// --- Helper: extract base64 image from generateContent response ---
function extractImage(data, label) {
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    console.log(`  [${label}] No candidates in response`);
    console.log(`  Response: ${JSON.stringify(data).slice(0, 500)}`);
    return null;
  }

  const parts = candidates[0].content?.parts;
  if (!parts) {
    console.log(`  [${label}] No parts in candidate`);
    console.log(`  Candidate: ${JSON.stringify(candidates[0]).slice(0, 500)}`);
    return null;
  }

  for (const part of parts) {
    if (part.text) {
      console.log(`  [${label}] Text response: ${part.text.slice(0, 200)}`);
    }
    if (part.inlineData) {
      const { mimeType, data: b64 } = part.inlineData;
      console.log(`  [${label}] Got image! mimeType=${mimeType}, base64 length=${b64.length}`);
      return Buffer.from(b64, "base64");
    }
  }

  console.log(`  [${label}] No image data found in parts`);
  return null;
}

// --- Main ---
async function main() {
  console.log("=== Gemini Image Generation Script ===");
  console.log(`Prompt: "${PROMPT}"`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log("");

  const strategies = [
    tryGeminiFlashImage,
    tryGemini2FlashImage,
    tryImagen,
    tryGemini25FlashImage,
  ];

  for (const strategy of strategies) {
    try {
      const imageBuffer = await strategy();
      if (imageBuffer) {
        // Ensure output directory exists
        fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
        fs.writeFileSync(OUTPUT_PATH, imageBuffer);
        console.log(`\nImage saved to: ${OUTPUT_PATH}`);
        console.log(`File size: ${imageBuffer.length} bytes`);
        return;
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
    console.log("");
  }

  console.log("\nAll strategies failed. Could not generate image.");
  process.exit(1);
}

main();
