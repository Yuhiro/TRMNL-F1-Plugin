#!/usr/bin/env node
// Validates that all fixture files in fixtures/ match the current payload schema.
// Run after any field rename in build-payload.js to catch drift before preview breaks silently.
// Usage: node scripts/validate-fixtures.js

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

// Keys that must be present at the top level for each view family.
// Add to these when new required fields are introduced in build-payload.js.
const REQUIRED_KEYS = {
  off_season:    ['view', 'season', 'champions', 'standings'],
  race_weekend:  ['view', 'meeting', 'standings'],
  post_race:     ['view', 'meeting', 'standings', 'winner'],
};

function requiredFor(view) {
  return REQUIRED_KEYS[view] ?? REQUIRED_KEYS.race_weekend;
}

// Sub-key checks for commonly renamed fields
const REQUIRED_MEETING_KEYS  = ['name', 'location', 'dates'];
const REQUIRED_STANDING_KEYS = { race: ['teams', 'drivers'], off_season: ['teams', 'd1', 'd2'] };
const REQUIRED_WINNER_KEYS   = ['name', 'team', 'grid'];
const REQUIRED_NEXT_RACE_KEYS = ['name', 'location', 'dates'];

let passed = 0;
let failed = 0;

for (const file of fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json')).sort()) {
  const fpath = path.join(FIXTURES_DIR, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fpath, 'utf8'));
  } catch (err) {
    process.stderr.write(`FAIL  ${file}: invalid JSON — ${err.message}\n`);
    failed++;
    continue;
  }

  const errors = [];

  // Top-level required keys
  const required = requiredFor(data.view);
  for (const k of required) {
    if (!(k in data)) errors.push(`missing top-level key '${k}'`);
  }

  // meeting sub-keys (race views only)
  if (data.view !== 'off_season' && data.meeting) {
    for (const k of REQUIRED_MEETING_KEYS) {
      if (!(k in data.meeting)) errors.push(`missing meeting.${k}`);
    }
  }

  // standings sub-keys
  if (data.standings) {
    const keys = data.view === 'off_season' ? REQUIRED_STANDING_KEYS.off_season : REQUIRED_STANDING_KEYS.race;
    for (const k of keys) {
      if (!(k in data.standings)) errors.push(`missing standings.${k}`);
    }
  }

  // winner sub-keys (post_race only)
  if (data.view === 'post_race') {
    if (!data.winner) {
      errors.push(`missing top-level key 'winner' (required for post_race)`);
    } else {
      for (const k of REQUIRED_WINNER_KEYS) {
        if (!(k in data.winner)) errors.push(`missing winner.${k}`);
      }
    }
  }

  // last_session sub-keys (present when a session has completed)
  if (data.last_session) {
    if (!('name' in data.last_session)) errors.push(`missing last_session.name`);
    if (!('results' in data.last_session)) errors.push(`missing last_session.results`);
  }

  // next_race sub-keys (post_race only)
  if (data.next_race) {
    for (const k of REQUIRED_NEXT_RACE_KEYS) {
      if (!(k in data.next_race)) errors.push(`missing next_race.${k}`);
    }
  }

  if (errors.length) {
    process.stderr.write(`FAIL  ${file} (view=${data.view ?? 'unknown'}):\n`);
    for (const e of errors) process.stderr.write(`        ${e}\n`);
    failed++;
  } else {
    process.stdout.write(`ok    ${file}\n`);
    passed++;
  }
}

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
