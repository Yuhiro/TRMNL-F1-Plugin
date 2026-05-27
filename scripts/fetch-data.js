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


async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
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
function findCurrentMeeting(meetings, rounds) {
  const n = new Date();

  for (const m of meetings) {
    if (m.is_cancelled) continue;
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

async function getWeatherForecast(circuitShortName, sessionDateISO) {
  const coords = CIRCUITS[circuitShortName];
  if (!coords) {
    process.stderr.write(`No coords for circuit: ${circuitShortName}\n`);
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
  const rounds = assignRoundNumbers(meetings);
  const { meeting, mode } = findCurrentMeeting(meetings, rounds);

  let view;
  const output = {
    mode,
    timezone: process.env.USER_TIMEZONE || 'UTC',
    meeting,
    sessions: [],
    weather: null,
    forecasts: {},
    standings: { drivers: [], constructors: [] },
  };

  if (!meeting) {
    output.mode = 'off_season';
    const { drivers, constructors } = await getStandings();
    output.standings = { drivers, constructors };
  }

  if (meeting) {
    const rawSessions = await getSessions(meeting.meeting_key);
    output.sessions = classifySessions(rawSessions);

    const liveSession = output.sessions.find(s => s.status === 'live');
    const upcomingSessions = output.sessions.filter(s => s.status === 'upcoming');

    // Fetch standings, live weather, and forecasts all in parallel
    const uniqueDates = [...new Map(upcomingSessions.map(s => [s.date_start.slice(0, 10), s.date_start])).entries()];
    const [standingsResult, liveWeather, ...forecastResults] = await Promise.all([
      getStandings(),
      liveSession
        ? getLiveWeather(liveSession.session_key).catch(err => {
            process.stderr.write(`Live weather fetch failed (skipping): ${err.message}\n`);
            return null;
          })
        : Promise.resolve(null),
      ...uniqueDates.map(([dateStr, date_start]) =>
        getWeatherForecast(meeting.circuit_short_name, date_start)
          .then(forecast => ({ dateStr, forecast }))
          .catch(err => { process.stderr.write(`Forecast fetch failed for ${dateStr} (skipping): ${err.message}\n`); return null; })
      ),
    ]);
    output.standings = standingsResult;
    const driverByNumber = Object.fromEntries(standingsResult.drivers.map(d => [d.driver_number, d]));
    output.weather = liveWeather;
    for (const result of forecastResults) {
      if (result?.forecast) output.forecasts[result.dateStr] = result.forecast;
    }

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

    const lastCompleted = output.sessions.filter(s => s.status === 'completed').at(-1);
    if (lastCompleted) {
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
      const nextSessions = await nextSessionsPromise;
      if (nextSessions) {
        const raceSession = nextSessions.find(s => s.session_name === 'Race');
        let raceForecast = null;
        if (raceSession) {
          try {
            raceForecast = await getWeatherForecast(nextMeet.circuit_short_name, raceSession.date_start);
          } catch (err) {
            process.stderr.write(`Next race forecast failed (skipping): ${err.message}\n`);
          }
        }
        output.next_meeting = {
          ...nextMeet,
          round_number: rounds.get(nextMeet.meeting_key),
          sessions: nextSessions,
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
