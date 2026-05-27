#!/usr/bin/env node
// Fetches all data needed for the TRMNL F1 plugin and writes JSON to stdout.

const OPENF1_BASE = 'https://api.openf1.org/v1';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const CIRCUITS = require('./circuits');

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


// One retry with 2 s backoff — a single transient OpenF1 500 or network blip would
// otherwise exit the pipeline and leave the display stale until the next run.
async function fetchJSON(url, retries = 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.json();
  } catch (err) {
    if (retries > 0) {
      process.stderr.write(`Fetch failed, retrying in 2s: ${err.message}\n`);
      await new Promise(resolve => setTimeout(resolve, 2_000));
      return fetchJSON(url, retries - 1);
    }
    throw err;
  }
}

async function getMeetings() {
  const year = new Date().getFullYear();
  const meetings = await fetchJSON(`${OPENF1_BASE}/meetings?year=${year}`);
  // If every non-cancelled meeting in the current year is in the past, the new season
  // calendar may not be published yet — try next year as a fallback.
  // Cancelled meetings can have future dates, so they must be excluded from this check
  // or a cancelled end-of-season entry would block the year rollover indefinitely.
  const allPast = meetings.length > 0 && meetings.filter(m => !m.is_cancelled).every(m => new Date(m.date_end) < new Date());
  if (allPast) {
    const next = await fetchJSON(`${OPENF1_BASE}/meetings?year=${year + 1}`).catch(() => []);
    if (next.length > 0) return next;
  }
  return meetings;
}

// Assigns 1-based round numbers to non-cancelled meetings sorted by date.
function assignRoundNumbers(meetings) {
  const sorted = meetings
    .filter(m => !m.is_cancelled && !/test/i.test(m.meeting_official_name ?? ''))
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
  const rounds = new Map();
  sorted.forEach((m, i) => rounds.set(m.meeting_key, i + 1));
  return rounds;
}

// Returns the meeting currently in progress, or the next upcoming one.
function findCurrentMeeting(meetings, rounds) {
  const n = new Date();

  for (const m of meetings) {
    if (m.is_cancelled) continue;
    const start = new Date(m.date_start);
    // Add 4h buffer after date_end to keep race-weekend mode through post-race
    const end = new Date(new Date(m.date_end).getTime() + 4 * 60 * 60 * 1000);
    if (n >= start && n <= end) {
      return { meeting: { ...m, round_number: rounds.get(m.meeting_key) } };
    }
  }

  const upcoming = meetings
    .filter(m => !m.is_cancelled && new Date(m.date_start) > n)
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

  const next = upcoming[0] ?? null;
  return {
    meeting: next ? { ...next, round_number: rounds.get(next.meeting_key) } : null,
  };
}

async function getSessions(meetingKey) {
  return fetchJSON(`${OPENF1_BASE}/sessions?meeting_key=${meetingKey}`);
}

// Race and Sprint sessions routinely run 5–20 min over their scheduled end time.
// Without a buffer, the LIVE badge disappears and result fetches fire before the API has data.
const OVERRUN_BUFFER_MS = 30 * 60 * 1000;

function classifySessions(sessions) {
  const n = new Date();
  return sessions
    .map(s => {
      const start = new Date(s.date_start);
      const end = new Date(s.date_end);
      // Extend the effective end time for sessions that commonly overrun their schedule
      const effectiveEnd = ['Race', 'Sprint'].includes(s.session_name)
        ? new Date(end.getTime() + OVERRUN_BUFFER_MS)
        : end;
      let status;
      if (n >= start && n <= effectiveEnd) status = 'live';
      else if (n > effectiveEnd) status = 'completed';
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

async function getSessionResult(sessionKey) {
  return fetchJSON(`${OPENF1_BASE}/session_result?session_key=${sessionKey}`);
}

async function getStints(sessionKey) {
  return fetchJSON(`${OPENF1_BASE}/stints?session_key=${sessionKey}`);
}

// Converts an OpenF1 broadcast_name to a short display form.
// OpenF1 format: "INITIAL SURNAME" — always a single uppercase letter followed by the
// surname in all-caps (e.g. "M VERSTAPPEN", "C LECLERC", "G RUSSELL").
// Multi-word surnames (e.g. "M DE VRIES") are handled correctly: each word is
// title-cased and joined, producing "M. De Vries".
// If broadcast_name deviates from this pattern (full first name, or reversed
// "SURNAME GIVEN" order), the first token is treated as the initial and the result
// will look wrong — that would be an OpenF1 API change worth investigating.
function formatBroadcastName(name) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const initial = parts[0];
  const surname = parts.slice(1).map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
  return `${initial}. ${surname}`;
}

async function getStandings() {
  let rawDrivers, rawDriverInfo;
  try {
    [rawDrivers, rawDriverInfo] = await Promise.all([
      fetchJSON(`${OPENF1_BASE}/championship_drivers?session_key=latest`),
      fetchJSON(`${OPENF1_BASE}/drivers?session_key=latest`).catch(err => {
        process.stderr.write(`Driver team fetch failed, falling back to static map: ${err.message}\n`);
        return [];
      }),
    ]);
  } catch {
    return { drivers: [], constructors: [] };
  }

  // Build live team map and per-driver meta from /drivers; fall back to static DRIVER_MAP per entry
  const liveTeamMap = {};
  const driverMeta = {};
  for (const d of rawDriverInfo) {
    if (d.driver_number != null) {
      if (d.team_name) liveTeamMap[d.driver_number] = d.team_name;
      driverMeta[d.driver_number] = {
        portrait_url: d.headshot_url ?? null,
        full_name: d.full_name ?? null,
        name: formatBroadcastName(d.broadcast_name),
      };
    }
  }

  // Normalize API full team names → short codes using DRIVER_MAP as the canonical key
  const fullNameToCode = {};
  for (const [driverNumber, fullName] of Object.entries(liveTeamMap)) {
    const code = DRIVER_MAP[driverNumber]?.team;
    if (code) fullNameToCode[fullName] = code;
  }

  const drivers = rawDrivers.map(d => ({
    ...d,
    acronym: DRIVER_MAP[d.driver_number]?.acronym ?? `#${d.driver_number}`,
    team: fullNameToCode[liveTeamMap[d.driver_number]] ?? DRIVER_MAP[d.driver_number]?.team ?? '???',
    name: driverMeta[d.driver_number]?.name ?? null,
    full_name: driverMeta[d.driver_number]?.full_name ?? null,
    portrait_url: driverMeta[d.driver_number]?.portrait_url ?? null,
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

function determineView(sessions) {
  if (sessions.some(s => s.status === 'live')) return 'live';
  if (sessions.some(s => s.session_name === 'Race' && s.status === 'completed')) return 'post_race';
  if (sessions.some(s => s.status === 'completed')) return 'race_weekend';
  return 'pre_weekend';
}

// Fetches forecasts for all given dates in a single Open-Meteo request.
// Returns a { [dateStr]: { temp_max, precip_probability, weathercode } } map.
async function getWeatherForecasts(circuitShortName, datestrs) {
  const coords = CIRCUITS[circuitShortName];
  if (!coords) {
    process.stderr.write(`No coords for circuit: ${circuitShortName}\n`);
    return {};
  }
  const sorted = [...datestrs].sort();
  const url =
    `${OPEN_METEO_BASE}` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&daily=temperature_2m_max,precipitation_probability_max,weathercode` +
    `&timezone=UTC&start_date=${sorted[0]}&end_date=${sorted[sorted.length - 1]}`;
  const data = await fetchJSON(url);
  if (!data.daily?.time?.length) return {};
  const result = {};
  for (let i = 0; i < data.daily.time.length; i++) {
    result[data.daily.time[i]] = {
      temp_max: data.daily.temperature_2m_max[i],
      precip_probability: data.daily.precipitation_probability_max[i],
      weathercode: data.daily.weathercode[i],
    };
  }
  return result;
}

async function main() {
  const meetings = await getMeetings();
  const rounds = assignRoundNumbers(meetings);
  const { meeting } = findCurrentMeeting(meetings, rounds);

  let view;
  const output = {
    timezone: process.env.USER_TIMEZONE || 'UTC',
    meeting,
    sessions: [],
    weather: null,
    forecasts: {},
    standings: { drivers: [], constructors: [] },
  };

  if (!meeting) {
    const { drivers, constructors } = await getStandings();
    output.standings = { drivers, constructors };
  }

  if (meeting) {
    const rawSessions = await getSessions(meeting.meeting_key);
    output.sessions = classifySessions(rawSessions);

    const liveSession = output.sessions.find(s => s.status === 'live');
    const upcomingSessions = output.sessions.filter(s => s.status === 'upcoming');

    // Fetch standings, live weather, and forecasts all in parallel
    const uniqueDates = [...new Set(upcomingSessions.map(s => s.date_start.slice(0, 10)))];
    const [standingsResult, liveWeather, forecasts] = await Promise.all([
      getStandings(),
      liveSession
        ? getLiveWeather(liveSession.session_key).catch(err => {
            process.stderr.write(`Live weather fetch failed (skipping): ${err.message}\n`);
            return null;
          })
        : Promise.resolve(null),
      uniqueDates.length
        ? getWeatherForecasts(meeting.circuit_short_name, uniqueDates).catch(err => {
            process.stderr.write(`Forecast fetch failed (skipping): ${err.message}\n`);
            return {};
          })
        : Promise.resolve({}),
    ]);
    output.standings = standingsResult;
    output.weather = liveWeather;
    output.forecasts = forecasts;

    // Determine view early so we only fetch nextMeet when it will actually be used
    view = determineView(output.sessions);

    const nextMeet = view === 'post_race'
      ? meetings
          .filter(m => !m.is_cancelled && new Date(m.date_start) > new Date(meeting.date_end))
          .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))[0]
      : null;

    // Kick off nextMeet sessions fetch now so it runs in parallel with lastCompleted below
    const nextSessionsPromise = nextMeet ? getSessions(nextMeet.meeting_key).catch(err => {
      process.stderr.write(`Next meeting fetch failed (skipping): ${err.message}\n`);
      return null;
    }) : Promise.resolve(null);

    // Chain the race-day forecast directly off the sessions promise — raceSession.date_start
    // is available as soon as sessions resolve, so the forecast fetch starts concurrently
    // with the lastCompleted block below rather than sequentially after it (~200–400 ms saved).
    const nextForecastPromise = nextMeet ? nextSessionsPromise.then(sessions => {
      if (!sessions) return null;
      const raceSession = sessions.find(s => s.session_name === 'Race');
      if (!raceSession) return null;
      const dateStr = raceSession.date_start.slice(0, 10);
      return getWeatherForecasts(nextMeet.circuit_short_name, [dateStr])
        .then(map => map[dateStr] ?? null)
        .catch(err => {
          process.stderr.write(`Next race forecast failed (skipping): ${err.message}\n`);
          return null;
        });
    }) : Promise.resolve(null);

    const lastCompleted = output.sessions.filter(s => s.status === 'completed').at(-1);
    if (lastCompleted) {
      // Only built when needed: maps driver_number → enriched driver for result rows
      const driverByNumber = Object.fromEntries(standingsResult.drivers.map(d => [d.driver_number, d]));
      try {
        const showCompounds = ['Race', 'Sprint'].includes(lastCompleted.session_name);
        const qualiSession = lastCompleted.session_name === 'Race'
          ? output.sessions.find(s => s.session_name === 'Qualifying')
          : null;

        const [results, stints, qualiResults] = await Promise.all([
          getSessionResult(lastCompleted.session_key),
          showCompounds ? getStints(lastCompleted.session_key) : Promise.resolve([]),
          qualiSession
            ? getSessionResult(qualiSession.session_key).catch(err => {
                process.stderr.write(`Qualifying results fetch failed (skipping): ${err.message}\n`);
                return null;
              })
            : Promise.resolve(null),
        ]);

        const driverCompounds = {};
        for (const stint of stints) {
          const dn = stint.driver_number;
          if (!driverCompounds[dn]) driverCompounds[dn] = [];
          const letter = stint.compound?.[0] ?? '?';
          if (!driverCompounds[dn].includes(letter)) driverCompounds[dn].push(letter);
        }

        const top6 = results
          .filter(r => r.position != null)
          .sort((a, b) => a.position - b.position)
          .slice(0, 6);

        output.last_session = {
          session_key: lastCompleted.session_key,
          session_name: lastCompleted.session_name,
          results: top6.map(r => ({
            position: r.position,
            driver_number: r.driver_number,
            name: driverByNumber[r.driver_number]?.name ?? null,
            full_name: driverByNumber[r.driver_number]?.full_name ?? null,
            portrait_url: driverByNumber[r.driver_number]?.portrait_url ?? null,
            compounds: driverCompounds[r.driver_number] ?? [],
            duration: r.duration ?? null,
            gap_to_leader: r.gap_to_leader ?? null,
            dnf: r.dnf ?? false,
            dns: r.dns ?? false,
            dsq: r.dsq ?? false,
          })),
        };

        if (qualiResults) {
          output.qualifying_results = qualiResults
            .filter(r => r.position != null)
            .map(r => ({ driver_number: r.driver_number, position: r.position }));
        }
      } catch (err) {
        process.stderr.write(`Session result fetch failed (skipping): ${err.message}\n`);
      }
    }

    if (nextMeet) {
      const [nextSessions, raceForecast] = await Promise.all([nextSessionsPromise, nextForecastPromise]);
      if (nextSessions) {
        output.next_meeting = {
          ...nextMeet,
          round_number: rounds.get(nextMeet.meeting_key),
          sessions: nextSessions.slice().sort((a, b) => new Date(a.date_start) - new Date(b.date_start)),
          race_forecast: raceForecast,
        };
      }
    }
  }

  output.view = view ?? 'off_season';
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
