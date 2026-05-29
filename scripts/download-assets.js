#!/usr/bin/env node
// One-time script: downloads circuit map images and driver portrait images.
// Run once per season (or when circuits/drivers change), then commit the results.
//
// Usage:
//   node scripts/download-assets.js                        # current year, openf1 circuits
//   node scripts/download-assets.js 2025                   # specific year
//   node scripts/download-assets.js --source official      # F1 CDN circuit images
//   node scripts/download-assets.js --source both          # both circuit image sources
//   node scripts/download-assets.js 2025 --source both     # year + source

const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const CIRCUITS = require('./circuits');

const OPENF1_BASE = 'https://api.openf1.org/v1';
// F1 CDN: update year when the season changes and verify URL structure still holds.
const F1_CDN_YEAR = new Date().getFullYear();
const F1_CDN_BASE = `https://media.formula1.com/image/upload/c_fit,h_704/q_auto/common/f1/${F1_CDN_YEAR}/track`;
const PORTRAIT_CDN_BASE = 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/';

const OUT_OPENF1   = join(__dirname, '../assets/circuits/openf1');
const OUT_OFFICIAL = join(__dirname, '../assets/circuits/official');
const OUT_PORTRAITS = join(__dirname, '../assets/driver');

const year = (() => {
  const arg = process.argv.slice(2).find(a => /^\d{4}$/.test(a));
  return arg ? parseInt(arg, 10) : new Date().getFullYear();
})();

const source = (() => {
  const idx = process.argv.indexOf('--source');
  return idx !== -1 ? process.argv[idx + 1] : 'openf1';
})();

if (!['openf1', 'official', 'both'].includes(source)) {
  process.stderr.write(`Unknown --source "${source}". Use openf1, official, or both.\n`);
  process.exit(1);
}

async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function downloadImage(url, filepath) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(filepath, buffer);
}

async function downloadOpenF1Circuits() {
  mkdirSync(OUT_OPENF1, { recursive: true });
  process.stdout.write(`\nFetching ${year} meetings from OpenF1...\n`);
  const meetings = await fetchJSON(`${OPENF1_BASE}/meetings?year=${year}`);

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

async function downloadOfficialCircuits() {
  mkdirSync(OUT_OFFICIAL, { recursive: true });
  process.stdout.write(`\nDownloading official F1 CDN circuit images (${year})...\n`);

  const entries = Object.entries(CIRCUITS).filter(([, c]) => c.f1_slug);

  await Promise.allSettled(entries.map(async ([key, circuit]) => {
    const url = `${F1_CDN_BASE}/${year}track${circuit.f1_slug}detailed.webp`;
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

async function downloadPortraits() {
  mkdirSync(OUT_PORTRAITS, { recursive: true });
  process.stdout.write(`\nFetching ${year} driver portraits...\n`);

  // Find the last race session of the year to get an accurate driver roster.
  const meetings = await fetchJSON(`${OPENF1_BASE}/meetings?year=${year}`);
  const raceMeetings = meetings
    .filter(m => !m.is_cancelled && !/test/i.test(m.meeting_official_name ?? ''))
    .sort((a, b) => new Date(b.date_start) - new Date(a.date_start));

  if (raceMeetings.length === 0) {
    process.stdout.write(`  No meetings found for ${year} — skipping portraits\n`);
    return;
  }

  // Walk meetings newest-first until we find one with a Race session.
  let sessionKey = null;
  for (const meeting of raceMeetings) {
    const sessions = await fetchJSON(`${OPENF1_BASE}/sessions?meeting_key=${meeting.meeting_key}&session_name=Race`);
    if (sessions.length > 0) {
      sessionKey = sessions[0].session_key;
      process.stdout.write(`  Using session ${sessionKey} (${meeting.meeting_name})\n`);
      break;
    }
  }

  if (!sessionKey) {
    process.stdout.write(`  No Race session found for ${year} — skipping portraits\n`);
    return;
  }

  const drivers = await fetchJSON(`${OPENF1_BASE}/drivers?session_key=${sessionKey}`);

  await Promise.allSettled(drivers.map(async d => {
    if (!d.headshot_url) {
      process.stdout.write(`  SKIP #${d.driver_number} (${d.name_acronym ?? '?'}) — no portrait URL\n`);
      return;
    }

    // Upgrade 1col → 2col for higher-resolution portrait on the TRMNL X display.
    // Falls back gracefully if the CDN URL format doesn't include a col segment.
    const url = d.headshot_url.replace('/1col/', '/2col/');
    if (!url.startsWith(PORTRAIT_CDN_BASE)) {
      process.stdout.write(`  SKIP #${d.driver_number} (${d.name_acronym ?? '?'}) — unexpected portrait URL: ${d.headshot_url}\n`);
      return;
    }

    const filename = `${d.driver_number}.png`;
    const filepath = join(OUT_PORTRAITS, filename);
    process.stdout.write(`  Downloading #${d.driver_number} (${d.name_acronym ?? '?'})...\n`);
    try {
      await downloadImage(url, filepath);
      process.stdout.write(`  OK ${filename}\n`);
    } catch (err) {
      process.stdout.write(`  FAILED #${d.driver_number} (${d.name_acronym ?? '?'}): ${err.message}\n`);
    }
  }));
}

async function main() {
  process.stdout.write(`Downloading assets for ${year}...\n`);
  if (source === 'openf1' || source === 'both') await downloadOpenF1Circuits();
  if (source === 'official' || source === 'both') await downloadOfficialCircuits();
  await downloadPortraits();
  process.stdout.write('\nDone. Commit the new files in assets/ to make them available in production.\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
