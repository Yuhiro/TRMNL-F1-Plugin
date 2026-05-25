#!/usr/bin/env node
// One-time script: downloads circuit map images for all 2026 meetings from OpenF1.
// Run once, commit the downloaded images to assets/circuits/.
// Usage: node scripts/download-circuits.js

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../assets/circuits');

mkdirSync(OUT_DIR, { recursive: true });

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(filepath, buffer);
}

async function main() {
  process.stdout.write('Fetching 2026 meetings...\n');
  const meetings = await fetchJSON('https://api.openf1.org/v1/meetings?year=2026');

  for (const m of meetings) {
    if (!m.circuit_image) {
      process.stdout.write(`  SKIP ${m.circuit_short_name} — no circuit_image URL\n`);
      continue;
    }

    // Derive file extension from URL, default to png
    const ext = m.circuit_image.match(/\.(png|jpg|jpeg|webp|svg)/i)?.[1] ?? 'png';
    const filename = `${m.circuit_short_name}.${ext}`;
    const filepath = join(OUT_DIR, filename);

    process.stdout.write(`  Downloading ${m.circuit_short_name}...`);
    try {
      await downloadImage(m.circuit_image, filepath);
      process.stdout.write(` OK (${filename})\n`);
    } catch (err) {
      process.stdout.write(` FAILED: ${err.message}\n`);
    }
  }

  process.stdout.write('Done.\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
