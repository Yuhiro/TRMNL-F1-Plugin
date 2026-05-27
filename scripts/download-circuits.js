#!/usr/bin/env node
// One-time script: downloads circuit map images and commits them to assets/circuits/.
// Run once per season (or when circuits change), then commit the results.
//
// Usage:
//   node scripts/download-circuits.js                  # openf1 only (default)
//   node scripts/download-circuits.js --source openf1  # OpenF1 images → assets/circuits/openf1/
//   node scripts/download-circuits.js --source official # F1 CDN images → assets/circuits/official/
//   node scripts/download-circuits.js --source both    # download both sources

const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const CIRCUITS = require('./circuits');

const OPENF1_BASE = 'https://api.openf1.org/v1';
// F1 CDN: update year when the season changes and verify URL structure still holds.
const F1_CDN_YEAR = new Date().getFullYear();
const F1_CDN_BASE = `https://media.formula1.com/image/upload/c_fit,h_704/q_auto/common/f1/${F1_CDN_YEAR}/track`;

const OUT_OPENF1   = join(__dirname, '../assets/circuits/openf1');
const OUT_OFFICIAL = join(__dirname, '../assets/circuits/official');

const source = (() => {
  const idx = process.argv.indexOf('--source');
  return idx !== -1 ? process.argv[idx + 1] : 'openf1';
})();

if (!['openf1', 'official', 'both'].includes(source)) {
  process.stderr.write(`Unknown --source "${source}". Use openf1, official, or both.\n`);
  process.exit(1);
}

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

async function downloadOpenF1() {
  mkdirSync(OUT_OPENF1, { recursive: true });
  process.stdout.write(`\nFetching ${F1_CDN_YEAR} meetings from OpenF1...\n`);
  const meetings = await fetchJSON(`${OPENF1_BASE}/meetings?year=${F1_CDN_YEAR}`);

  await Promise.allSettled(meetings.map(async m => {
    if (!m.circuit_image) {
      process.stdout.write(`  SKIP ${m.circuit_short_name} — no circuit_image URL\n`);
      return;
    }
    const ext = m.circuit_image.match(/\.(png|jpg|jpeg|webp|svg)/i)?.[1] ?? 'png';
    const filename = `${m.circuit_short_name}.${ext}`;
    const filepath = join(OUT_OPENF1, filename);
    process.stdout.write(`  Downloading ${m.circuit_short_name}...\n`);
    try {
      await downloadImage(m.circuit_image, filepath);
      process.stdout.write(`  OK ${filename}\n`);
    } catch (err) {
      process.stdout.write(`  FAILED ${m.circuit_short_name}: ${err.message}\n`);
    }
  }));
}

async function downloadOfficial() {
  mkdirSync(OUT_OFFICIAL, { recursive: true });
  process.stdout.write(`\nDownloading official F1 CDN images (${F1_CDN_YEAR})...\n`);

  const entries = Object.entries(CIRCUITS).filter(([, c]) => c.f1_slug);

  await Promise.allSettled(entries.map(async ([key, circuit]) => {
    const url = `${F1_CDN_BASE}/${F1_CDN_YEAR}track${circuit.f1_slug}detailed.webp`;
    const filename = `${circuit.f1_slug}.webp`;
    const filepath = join(OUT_OFFICIAL, filename);
    process.stdout.write(`  Downloading ${key} (${circuit.f1_slug})...\n`);
    try {
      await downloadImage(url, filepath);
      process.stdout.write(`  OK ${filename}\n`);
    } catch (err) {
      process.stdout.write(`  FAILED ${key}: ${err.message}\n`);
    }
  }));
}

async function main() {
  if (source === 'openf1' || source === 'both') await downloadOpenF1();
  if (source === 'official' || source === 'both') await downloadOfficial();
  process.stdout.write('\nDone.\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
