import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error("Missing GOOGLE_API_KEY"); process.exit(1); }

const name = process.argv[2];
const prompt = process.argv[3];
if (!name || !prompt) { console.error("Usage: node generate-single.mjs <name> <prompt>"); process.exit(1); }

const outputPath = path.join(PROJECT_ROOT, "public/sprites/generated", `${name}.png`);
const model = "imagen-4.0-generate-001";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;

console.log(`Generating: ${name}`);
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
});
const data = await res.json();
if (!res.ok) { console.error("API error:", data.error?.message || JSON.stringify(data)); process.exit(1); }
const b64 = data.predictions?.[0]?.bytesBase64Encoded;
if (!b64) { console.error("No image in response"); process.exit(1); }
const buffer = Buffer.from(b64, "base64");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buffer);
console.log(`Saved: ${outputPath} (${buffer.length} bytes)`);
