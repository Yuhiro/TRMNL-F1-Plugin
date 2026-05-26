#!/usr/bin/env node
// Reads raw JSON from fetch-data.js (stdin), outputs TRMNL-ready merge_variables JSON.
// Usage: node scripts/fetch-data.js | node scripts/build-payload.js

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/yuhiro/TRMNL-F1-Plugin/main/assets/circuits';
const CIRCUITS = require('./circuits');

function circuitImageUrl(shortName) {
  const file = CIRCUITS[shortName]?.image;
  return file ? `${GITHUB_RAW_BASE}/${file}` : null;
}

function circuitName(shortName) {
  return CIRCUITS[shortName]?.name ?? shortName;
}

function circuitType(shortName) {
  return CIRCUITS[shortName]?.type ?? null;
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

// Open-Meteo WMO weathercode → Tabler Icon class
function weathercodeIcon(code) {
  if (code == null)                        return 'ti-cloud';
  if (code === 0)                           return 'ti-sun';
  if (code <= 2)                           return 'ti-cloud-sun';
  if (code === 3)                          return 'ti-cloud';
  if (code === 45 || code === 48)          return 'ti-mist';
  if (code >= 51 && code <= 55)            return 'ti-cloud-drizzle';
  if ((code >= 61 && code <= 65) ||
      (code >= 80 && code <= 82))          return 'ti-cloud-rain';
  if (code >= 71 && code <= 75)            return 'ti-snowflake';
  if (code === 95)                         return 'ti-cloud-storm';
  if (code === 96 || code === 99)          return 'ti-bolt';
  return 'ti-cloud';
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
      icon: liveWeather.rainfall ? 'ti-cloud-rain' : 'ti-sun',
      precip: liveWeather.rainfall ? 'Wet' : 'Dry',
    };
  }

  const f = forecasts[session.date_start.slice(0, 10)];
  if (!f) return null;
  return {
    temp: `${Math.round(f.temp_max)}°C`,
    icon: weathercodeIcon(f.weathercode),
    precip: `${f.precip_probability}%`,
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
    const data = JSON.parse(raw);
    const timezone = data.timezone || process.env.USER_TIMEZONE || 'UTC';
    const { meeting, sessions, weather, forecasts, standings, last_session, qualifying_results, next_meeting } = data;

    if (!meeting) {
      const year = new Date().getFullYear();
      const drivers = [...(standings.drivers ?? [])].sort((a, b) => (a.position_current ?? 99) - (b.position_current ?? 99));
      const constructors = standings.constructors ?? [];
      const wdc = drivers[0];
      const wcc = constructors[0];

      const payload = {
        view: 'off_season',
        season: { year },
        champions: {
          driver: {
            name: wdc?.full_name ?? wdc?.name ?? '',
            team: TEAM_NAMES[wdc?.team] ?? '',
            points: wdc?.points_current ?? 0,
            portrait_url: wdc?.portrait_url?.replace('/1col/', '/2col/') ?? null,
          },
          constructor: {
            name: TEAM_NAMES[wcc?.team] ?? wcc?.team ?? '',
            points: wcc?.points ?? 0,
          },
        },
        standings: {
          drivers_col1: drivers.slice(0, 11).map(d => ({
            position: d.position_current,
            name: d.name ?? `#${d.driver_number}`,
            points: d.points_current ?? 0,
            portrait_url: d.portrait_url ?? null,
          })),
          drivers_col2: drivers.slice(11).map(d => ({
            position: d.position_current,
            name: d.name ?? `#${d.driver_number}`,
            points: d.points_current ?? 0,
            portrait_url: d.portrait_url ?? null,
          })),
          constructors: constructors.map(c => ({
            position: c.position,
            name: TEAM_NAMES[c.team] ?? c.team,
            points: c.points,
          })),
        },
      };
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return;
    }

    const view = data.view;

    const payload = {
      view,
      meeting: {
        name: meeting.meeting_name,
        location: `${meeting.location}, ${meeting.country_name}`,
        round: meeting.round_number,
        circuit_name: circuitName(meeting.circuit_short_name),
        circuit_type: circuitType(meeting.circuit_short_name),
        circuit_image_url: circuitImageUrl(meeting.circuit_short_name),
        date_range: buildDateRange(sessions, timezone),
      },
      sessions: sessions.map(s => {
        const { day, month } = sessionDateParts(s.date_start, timezone);
        return {
          day,
          month,
          name: s.session_name,
          time_range: `${formatTime(s.date_start, timezone)} – ${formatTime(s.date_end, timezone)}`,
          status: s.status,
          weather: sessionWeather(s, weather, forecasts),
        };
      }),
      standings: {
        constructors: standings.constructors
          .slice(0, 6)
          .map(c => ({
            position: c.position,
            name: TEAM_NAMES[c.team] ?? c.team,
            points: c.points,
          })),
        drivers: standings.drivers
          .sort((a, b) => (a.position_current ?? 99) - (b.position_current ?? 99))
          .slice(0, 6)
          .map(d => ({
            position: d.position_current ?? 0,
            name: d.name ?? `#${d.driver_number}`,
            points: d.points_current ?? 0,
          })),
      },
    };

    if (last_session?.results?.length) {
      payload.last_session = {
        name: `${last_session.session_name} Results`,
        results: last_session.results.map(r => ({
          position: r.position,
          name: r.name ?? `#${r.driver_number}`,
          portrait_url: r.portrait_url,
          compounds: r.compounds,
          dnf: r.dnf ?? false,
          dns: r.dns ?? false,
          dsq: r.dsq ?? false,
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
        portrait_url: p1.portrait_url?.replace('/1col/', '/2col/') ?? null,
        grid_position: gridResult ? `P${gridResult.position}` : null,
        finish_position: 'P1',
      };
    }

    if (next_meeting) {
      payload.next_race = {
        name: next_meeting.meeting_name,
        location: `${next_meeting.location}, ${next_meeting.country_name}`,
        round: next_meeting.round_number,
        date_range: buildDateRange(next_meeting.sessions, timezone),
        weather: next_meeting.race_forecast ? {
          temp: `${Math.round(next_meeting.race_forecast.temp_max)}°C`,
          icon: weathercodeIcon(next_meeting.race_forecast.weathercode),
          precip: `${next_meeting.race_forecast.precip_probability}%`,
        } : null,
      };
    }

    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  });
}

main();
