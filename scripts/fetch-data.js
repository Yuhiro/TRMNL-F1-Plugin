#!/usr/bin/env node
// Fetches all data needed for the TRMNL F1 plugin and writes JSON to stdout.

const OPENF1_BASE = 'https://api.openf1.org/v1';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

// Static driver data: driver_number → acronym + team short code
// Used to enrich driver standings and derive constructor standings.
const DRIVER_MAP = {
   1: { acronym: 'NOR', team: 'MCL' },
   3: { acronym: 'VER', team: 'RBR' },
   5: { acronym: 'BOR', team: 'AUD' },
   6: { acronym: 'HAD', team: 'RBR' },
  10: { acronym: 'GAS', team: 'ALP' },
  11: { acronym: 'PER', team: 'CAD' },
  12: { acronym: 'ANT', team: 'MER' },
  14: { acronym: 'ALO', team: 'AMR' },
  16: { acronym: 'LEC', team: 'FER' },
  18: { acronym: 'STR', team: 'AMR' },
  23: { acronym: 'ALB', team: 'WIL' },
  27: { acronym: 'HUL', team: 'AUD' },
  30: { acronym: 'LAW', team: 'RBU' },
  31: { acronym: 'OCO', team: 'HAA' },
  41: { acronym: 'LIN', team: 'RBU' },
  43: { acronym: 'COL', team: 'ALP' },
  44: { acronym: 'HAM', team: 'FER' },
  55: { acronym: 'SAI', team: 'WIL' },
  63: { acronym: 'RUS', team: 'MER' },
  77: { acronym: 'BOT', team: 'CAD' },
  81: { acronym: 'PIA', team: 'MCL' },
  87: { acronym: 'BEA', team: 'HAA' },
};

// Lat/lon for Open-Meteo forecast lookups, keyed by OpenF1 meeting.location
const CIRCUIT_COORDS = {
  'Melbourne':   { lat: -37.8497, lon: 144.9680 },
  'Shanghai':    { lat:  31.3389, lon: 121.2198 },
  'Suzuka':      { lat:  34.8431, lon: 136.5413 },
  'Sakhir':      { lat:  26.0325, lon:  50.5106 },
  'Jeddah':      { lat:  21.6319, lon:  39.1044 },
  'Miami':       { lat:  25.9581, lon: -80.2389 },
  'Montréal':    { lat:  45.5051, lon: -73.5226 },
  'Monaco':      { lat:  43.7347, lon:   7.4205 },
  'Monte Carlo': { lat:  43.7347, lon:   7.4205 },
  'Barcelona':   { lat:  41.5700, lon:   2.2611 },
  'Spielberg':   { lat:  47.2197, lon:  14.7647 },
  'Silverstone': { lat:  52.0786, lon:  -1.0169 },
  'Spa-Francorchamps': { lat: 50.4372, lon: 5.9714 },
  'Budapest':    { lat:  47.5789, lon:  19.2486 },
  'Zandvoort':   { lat:  52.3888, lon:   4.5407 },
  'Monza':       { lat:  45.6156, lon:   9.2811 },
  'Madrid':      { lat:  40.4168, lon:  -3.7038 },
  'Baku':        { lat:  40.3697, lon:  49.8533 },
  'Marina Bay':  { lat:   1.2914, lon: 103.8639 },
  'Austin':      { lat:  30.1328, lon: -97.6411 },
  'Mexico City': { lat:  19.4042, lon: -99.0907 },
  'São Paulo':   { lat: -23.7036, lon: -46.6997 },
  'Las Vegas':   { lat:  36.1147, lon:-115.1728 },
  'Lusail':      { lat:  25.4900, lon:  51.4542 },
  'Yas Island':  { lat:  24.4672, lon:  54.6031 },
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function getMeetings() {
  return fetchJSON(`${OPENF1_BASE}/meetings?year=${new Date().getFullYear()}`);
}

// Assigns 1-based round numbers to non-cancelled meetings sorted by date.
function assignRoundNumbers(meetings) {
  const sorted = meetings
    .filter(m => !m.is_cancelled)
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
  const rounds = new Map();
  sorted.forEach((m, i) => rounds.set(m.meeting_key, i + 1));
  return rounds;
}

// Returns the meeting currently in progress, or the next upcoming one.
function findCurrentMeeting(meetings) {
  const n = new Date();
  const rounds = assignRoundNumbers(meetings);

  for (const m of meetings) {
    const start = new Date(m.date_start);
    // Add 4h buffer after date_end to keep race-weekend mode through post-race
    const end = new Date(new Date(m.date_end).getTime() + 4 * 60 * 60 * 1000);
    if (n >= start && n <= end) {
      return { meeting: { ...m, round_number: rounds.get(m.meeting_key) }, mode: 'race_weekend' };
    }
  }

  const upcoming = meetings
    .filter(m => !m.is_cancelled && new Date(m.date_start) > n)
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

  const next = upcoming[0] ?? null;
  return {
    meeting: next ? { ...next, round_number: rounds.get(next.meeting_key) } : null,
    mode: 'off_weekend',
  };
}

async function getSessions(meetingKey) {
  return fetchJSON(`${OPENF1_BASE}/sessions?meeting_key=${meetingKey}`);
}

function classifySessions(sessions) {
  const n = new Date();
  return sessions
    .map(s => {
      const start = new Date(s.date_start);
      const end = new Date(s.date_end);
      let status;
      if (n >= start && n <= end) status = 'live';
      else if (n > end) status = 'completed';
      else status = 'upcoming';
      return { ...s, status };
    })
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
}

async function getLiveWeather(sessionKey) {
  const data = await fetchJSON(`${OPENF1_BASE}/weather?session_key=${sessionKey}`);
  // API returns an array sorted by time; take the most recent entry
  return Array.isArray(data) && data.length ? data[data.length - 1] : null;
}

async function getStandings() {
  let rawDrivers = [];
  try {
    rawDrivers = await fetchJSON(`${OPENF1_BASE}/championship_drivers?session_key=latest`);
  } catch {
    return { drivers: [], constructors: [] };
  }

  // Enrich each driver entry with acronym + team from static map
  const drivers = rawDrivers.map(d => ({
    ...d,
    ...(DRIVER_MAP[d.driver_number] ?? { acronym: `#${d.driver_number}`, team: '???' }),
  }));

  // Derive constructor standings by summing points_current per team
  const teamPoints = {};
  for (const d of drivers) {
    if (!teamPoints[d.team]) teamPoints[d.team] = 0;
    teamPoints[d.team] += d.points_current ?? 0;
  }
  const constructors = Object.entries(teamPoints)
    .map(([team, points]) => ({ team, points }))
    .sort((a, b) => b.points - a.points)
    .map((c, i) => ({ ...c, position: i + 1 }));

  return { drivers, constructors };
}

async function getWeatherForecast(location, sessionDateISO) {
  const coords = CIRCUIT_COORDS[location];
  if (!coords) {
    process.stderr.write(`No coords for location: ${location}\n`);
    return null;
  }
  const dateStr = sessionDateISO.slice(0, 10);
  const url =
    `${OPEN_METEO_BASE}` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&daily=temperature_2m_max,precipitation_probability_max,weathercode` +
    `&timezone=UTC&start_date=${dateStr}&end_date=${dateStr}`;
  const data = await fetchJSON(url);
  if (!data.daily?.time?.length) return null;
  return {
    temp_max: data.daily.temperature_2m_max[0],
    precip_probability: data.daily.precipitation_probability_max[0],
    weathercode: data.daily.weathercode[0],
  };
}

async function main() {
  const meetings = await getMeetings();
  const { meeting, mode } = findCurrentMeeting(meetings);

  const output = {
    mode,
    timezone: process.env.USER_TIMEZONE || 'UTC',
    meeting,
    sessions: [],
    weather: null,
    forecasts: {},
    standings: { drivers: [], constructors: [] },
    upcomingMeetings: [],
  };

  if (mode === 'off_weekend') {
    const n = new Date();
    output.upcomingMeetings = meetings
      .filter(m => new Date(m.date_start) > n)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
      .slice(0, 3);
  }

  if (meeting) {
    const rawSessions = await getSessions(meeting.meeting_key);
    output.sessions = classifySessions(rawSessions);

    const liveSession = output.sessions.find(s => s.status === 'live');
    const upcomingSessions = output.sessions.filter(s => s.status === 'upcoming');

    if (liveSession) {
      try {
        output.weather = await getLiveWeather(liveSession.session_key);
      } catch (err) {
        process.stderr.write(`Live weather fetch failed (skipping): ${err.message}\n`);
      }
    }

    // Fetch one Open-Meteo forecast per unique date among upcoming sessions
    const seenDates = new Set();
    for (const s of upcomingSessions) {
      const dateStr = s.date_start.slice(0, 10);
      if (!seenDates.has(dateStr)) {
        seenDates.add(dateStr);
        try {
          const forecast = await getWeatherForecast(meeting.location, s.date_start);
          if (forecast) output.forecasts[dateStr] = forecast;
        } catch (err) {
          process.stderr.write(`Forecast fetch failed for ${dateStr} (skipping): ${err.message}\n`);
        }
      }
    }

    output.standings = await getStandings();
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
