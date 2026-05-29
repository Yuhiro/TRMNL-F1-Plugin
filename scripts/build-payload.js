#!/usr/bin/env node
// Reads raw JSON from fetch-data.js (stdin), outputs TRMNL-ready merge_variables JSON.
// Usage: node scripts/fetch-data.js | node scripts/build-payload.js

// GITHUB_REPOSITORY is injected automatically by GitHub Actions (format: 'owner/repo').
// For local pipeline runs, set it in your shell: export GITHUB_REPOSITORY=owner/repo
// preview.js rewrites these URLs to local paths, so circuit images work in preview without this.
if (!process.env.GITHUB_REPOSITORY) {
  process.stderr.write('Warning: GITHUB_REPOSITORY not set — asset URLs will not resolve\n');
}
const { existsSync } = require('fs');
const { join } = require('path');
const GITHUB_ASSETS_BASE = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY ?? ''}/main/assets`;
const CIRCUITS = require('./circuits');

// Portrait images are self-hosted in assets/portraits/{driver_number}.png (downloaded via
// download-assets.js). Serving from GitHub raw avoids F1 CDN hotlink protection which
// caused intermittent broken images when TRMNL's server fetched directly from formula1.com.
const PORTRAITS_DIR = join(__dirname, '../assets/driver');

// CIRCUIT_IMAGE_SOURCE controls which set of circuit images is used.
// Set via GitHub Actions repository variable (Settings → Secrets and variables → Variables).
// Values: 'official' (F1 CDN images) or 'openf1' (OpenF1 images).
// Default: 'openf1' — no variable needed for the default behaviour.
const CIRCUIT_IMAGE_SOURCE = process.env.CIRCUIT_IMAGE_SOURCE || 'openf1';

// Returns the relative asset path for a circuit image (template prepends assets_base).
function circuitImagePath(shortName) {
  const circuit = CIRCUITS[shortName];
  if (!circuit) return null;

  // Official F1 CDN images — fall back to OpenF1 if no slug exists for this circuit.
  if (CIRCUIT_IMAGE_SOURCE === 'official') {
    if (circuit.f1_slug) {
      return `circuits/official/${circuit.f1_slug}.webp`;
    }
    process.stderr.write(`Warning: no f1_slug for ${shortName}, falling back to openf1\n`);
  }

  // OpenF1 images (default).
  return circuit.image ? `circuits/openf1/${circuit.image}` : null;
}

function circuitName(shortName) {
  return CIRCUITS[shortName]?.name ?? shortName;
}

function circuitType(shortName) {
  return CIRCUITS[shortName]?.type ?? null;
}

// Returns the relative asset path for a driver portrait, or null if the file hasn't been
// downloaded yet (e.g. a mid-season replacement). Null → template shows a placeholder div.
function portraitPath(driverNumber) {
  if (!driverNumber) return null;
  if (!existsSync(join(PORTRAITS_DIR, `${driverNumber}.png`))) return null;
  return `driver/${driverNumber}.png`;
}

// team short code → full display name
const TEAM_NAMES = {
  MCL: 'McLaren',
  MER: 'Mercedes',
  FER: 'Ferrari',
  RBR: 'Red Bull',
  AMR: 'Aston Martin',
  ALP: 'Alpine',
  AUD: 'Audi',
  WIL: 'Williams',
  RBU: 'Racing Bulls',
  HAA: 'Haas',
  CAD: 'Cadillac',
};

// Open-Meteo WMO weathercode → Tabler Icon suffix (without "ti-" prefix; template prepends it)
function weathercodeIcon(code) {
  if (code == null)                        return 'cloud';
  if (code <= 2)                            return 'sun';
  if (code === 3)                           return 'cloud';
  if (code === 45 || code === 48)           return 'mist';
  if (code >= 51 && code <= 57)             return 'cloud-rain';
  if ((code >= 61 && code <= 67) ||
      (code >= 80 && code <= 82))          return 'cloud-rain';
  if ((code >= 71 && code <= 75) ||
      code === 77 ||
      (code >= 85 && code <= 86))          return 'snowflake';
  if (code === 95)                         return 'cloud-storm';
  if (code === 96 || code === 99)          return 'bolt';
  return 'cloud';
}

function formatTime(isoStr, timezone) {
  return new Date(isoStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function sessionDateParts(isoStr, timezone) {
  const d = new Date(isoStr);
  return {
    day: d.toLocaleDateString('en-CA', { day: 'numeric', timeZone: timezone }),
    month: d.toLocaleDateString('en-CA', { month: 'short', timeZone: timezone }),
  };
}

function buildDateRange(sessions, timezone) {
  if (!sessions.length) return '';
  const localDates = sessions.map(s => {
    const d = new Date(s.date_start);
    return {
      day: parseInt(d.toLocaleDateString('en-CA', { day: 'numeric', timeZone: timezone })),
      monthName: d.toLocaleDateString('en-CA', { month: 'short', timeZone: timezone }),
    };
  });
  const days = localDates.map(d => d.day);
  const first = localDates[0];
  const last = localDates[localDates.length - 1];
  if (first.monthName === last.monthName) {
    return `${first.monthName} ${Math.min(...days)} – ${Math.max(...days)}`;
  }
  return `${first.monthName} ${first.day} – ${last.monthName} ${last.day}`;
}

function sessionWeather(session, liveWeather, forecasts) {
  if (session.status === 'completed') return null;

  if (session.status === 'live' && liveWeather) {
    return {
      temp: `${Math.round(liveWeather.air_temperature)}°C`,
      icon: liveWeather.rainfall ? 'cloud-rain' : 'sun',
      precip: liveWeather.rainfall ? 'Wet' : 'Dry',
    };
  }

  const f = forecasts[session.date_start.slice(0, 10)];
  if (!f) return null;
  return {
    temp: `${Math.round(f.temp_max)}°C`,
    icon: weathercodeIcon(f.weathercode),
    precip: f.precip_probability != null ? `${f.precip_probability}%` : '—',
  };
}

function formatLapTime(seconds) {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sWhole = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const sStr = String(sWhole).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${sStr}.${msStr}`;
  return `${m}:${sStr}.${msStr}`;
}

function formatGap(gap) {
  if (gap == null) return '';
  if (typeof gap === 'string') return gap.startsWith('+') ? gap : `+${gap}`;
  return `+${gap.toFixed(3)}s`;
}


function main() {
  let raw = '';
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(raw);
      const timezone = data.timezone || process.env.USER_TIMEZONE || 'UTC';
      const { meeting, sessions, weather, forecasts, standings, last_session, qualifying_results, next_meeting } = data;

      if (!meeting) {
        // FORCE_SEASON (repo variable): mirrors the value set in fetch-data.js so the season year
        // displayed in the off_season template header matches the forced season, not the current year.
        const year = process.env.FORCE_SEASON ? parseInt(process.env.FORCE_SEASON, 10) : new Date().getFullYear();
        const drivers = [...(standings.drivers ?? [])].sort((a, b) => (a.position_current ?? 99) - (b.position_current ?? 99));
        const constructors = standings.constructors ?? [];
        const wdc = drivers[0];
        const wcc = constructors[0];
        // MAX_STANDINGS_DRIVERS (repo variable): caps the number of drivers shown in the off_season
        // standings table. Useful for testing layout at different row counts.
        // Splits the total evenly across both columns. Unset = all drivers shown (normal behaviour).
        const driverLimit = process.env.MAX_STANDINGS_DRIVERS ? parseInt(process.env.MAX_STANDINGS_DRIVERS, 10) : drivers.length;

        const payload = {
          view: data.view,
          assets_base: GITHUB_ASSETS_BASE,
          season: { year },
          champions: {
            driver: {
              name: wdc?.full_name ?? wdc?.name ?? '',
              team: TEAM_NAMES[wdc?.team] ?? '',
              pts: wdc?.points_current ?? 0,
              img: portraitPath(wdc?.driver_number),
            },
            constructor: {
              name: TEAM_NAMES[wcc?.team] ?? wcc?.team ?? '',
              pts: wcc?.points ?? 0,
            },
          },
          standings: {
            d1: drivers.slice(0, Math.ceil(driverLimit / 2)).map(d => ({
              p: d.position_current,
              n: d.name ?? `#${d.driver_number}`,
              pts: d.points_current ?? 0,
            })),
            d2: drivers.slice(Math.ceil(driverLimit / 2), driverLimit).map(d => ({
              p: d.position_current,
              n: d.name ?? `#${d.driver_number}`,
              pts: d.points_current ?? 0,
            })),
            t: constructors.map(c => ({
              p: c.position,
              n: TEAM_NAMES[c.team] ?? c.team,
              pts: c.points,
            })),
          },
        };
        process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
        return;
      }

      const view = data.view;
      const hasResults = !!(last_session?.results?.length);

      const payload = {
        view,
        assets_base: GITHUB_ASSETS_BASE,
        meeting: {
          name: meeting.meeting_name,
          location: `${meeting.location}, ${meeting.country_name}`,
          dates: `${buildDateRange(sessions, timezone)}${meeting.round_number ? ` (Round ${meeting.round_number})` : ''}`,
          ...(!hasResults && {
            circuit: (() => { const n = circuitName(meeting.circuit_short_name); const t = circuitType(meeting.circuit_short_name); return t ? `${n} (${t})` : n; })(),
            map: circuitImagePath(meeting.circuit_short_name),
          }),
        },
        ...(view !== 'post_race' && {
          sessions: sessions.map(s => {
            const { day, month } = sessionDateParts(s.date_start, timezone);
            const w = sessionWeather(s, weather, forecasts);
            return {
              day,
              month,
              name: s.session_name,
              t: `${formatTime(s.date_start, timezone)} – ${formatTime(s.date_end, timezone)}`,
              ...(s.status === 'completed' && { done: true }),
              ...(s.status === 'live' && { status: 'live' }),
              ...(w !== null && { weather: w }),
            };
          }),
        }),
        standings: {
          t: standings.constructors
            .slice(0, 6)
            .map(c => {
              const delta = (c.position_start ?? c.position) - c.position;
              return {
                p: c.position,
                n: TEAM_NAMES[c.team] ?? c.team,
                pts: c.points,
                ...(delta !== 0 && { delta }),
              };
            }),
          d: standings.drivers
            .sort((a, b) => (a.position_current ?? 99) - (b.position_current ?? 99))
            .slice(0, 6)
            .map(d => {
              const delta = (d.position_start ?? d.position_current ?? 0) - (d.position_current ?? 0);
              return {
                p: d.position_current ?? 0,
                n: d.name ?? `#${d.driver_number}`,
                pts: d.points_current ?? 0,
                ...(delta !== 0 && { delta }),
              };
            }),
        },
      };

      if (last_session?.results?.length) {
        payload.last_session = {
          name: last_session.session_name,
          results: last_session.results.map(r => ({
            p: r.position,
            n: r.name ?? `#${r.driver_number}`,
            img: portraitPath(r.driver_number),
            cpd: 'S|M|H',
            ...(r.dnf && { dnf: true }),
            ...(r.dns && { dns: true }),
            ...(r.dsq && { dsq: true }),
            time: r.position === 1 ? formatLapTime(r.duration) : formatGap(r.gap_to_leader),
          })),
        };
      }

      if (view === 'post_race' && last_session?.results?.length) {
        const p1 = last_session.results[0];
        const gridResult = qualifying_results?.find(r => r.driver_number === p1.driver_number);
        const p1Standing = standings.drivers?.find(d => d.driver_number === p1.driver_number);
        payload.winner = {
          name: p1.full_name ?? p1.name ?? `#${p1.driver_number}`,
          team: TEAM_NAMES[p1Standing?.team] ?? '',
          img: portraitPath(p1.driver_number),
          grid: gridResult ? `P${gridResult.position}` : null,
        };
      }

      if (next_meeting) {
        payload.next_race = {
          name: next_meeting.meeting_name,
          location: `${next_meeting.location}, ${next_meeting.country_name}`,
          dates: `${buildDateRange(next_meeting.sessions, timezone)}${next_meeting.round_number ? ` (Round ${next_meeting.round_number})` : ''}`,
          weather: next_meeting.race_forecast ? {
            temp: `${Math.round(next_meeting.race_forecast.temp_max)}°C`,
            icon: weathercodeIcon(next_meeting.race_forecast.weathercode),
            precip: next_meeting.race_forecast.precip_probability != null ? `${next_meeting.race_forecast.precip_probability}%` : '—',
          } : null,
        };
      }

      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } catch (err) {
      process.stderr.write(`Fatal: ${err.message}\n`);
      process.exit(1);
    }
  });
}

main();
