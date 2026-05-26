#!/usr/bin/env node
// Reads raw JSON from fetch-data.js (stdin), outputs TRMNL-ready merge_variables JSON.
// Usage: node scripts/fetch-data.js | node scripts/build-payload.js

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/yuhiro/TRMNL-F1-Plugin/main/assets/circuits';

// circuit_short_name → { name, type, image }
const CIRCUIT_INFO = {
  'Austin':             { name: 'Circuit of the Americas', type: 'Permanent',  image: 'Austin.png' },
  'Baku':               { name: 'Baku City Circuit',       type: 'Street',     image: 'Baku.png' },
  'Hungaroring':        { name: 'Hungaroring',             type: 'Permanent',  image: 'Hungaroring.png' },
  'Interlagos':         { name: 'Interlagos',              type: 'Permanent',  image: 'Interlagos.png' },
  'Jeddah':             { name: 'Jeddah Corniche Circuit', type: 'Street',     image: 'Jeddah.png' },
  'Las Vegas':          { name: 'Las Vegas Strip Circuit', type: 'Street',     image: 'Las-Vegas.png' },
  'Lusail':             { name: 'Lusail International',    type: 'Permanent',  image: 'Lusail.png' },
  'Madring':            { name: 'Madrid Street Circuit',   type: 'Street',     image: 'Madring.png' },
  'Melbourne':          { name: 'Albert Park',             type: 'Street',     image: 'Melbourne.png' },
  'Mexico City':        { name: 'Autódromo Hermanos Rodríguez', type: 'Permanent', image: 'Mexico-City.png' },
  'Miami':              { name: 'Miami International',     type: 'Street',     image: 'Miami.png' },
  'Monte Carlo':        { name: 'Circuit de Monaco',       type: 'Street',     image: 'Monte-Carlo.png' },
  'Montreal':           { name: 'Circuit Gilles Villeneuve', type: 'Street',   image: 'Montreal.png' },
  'Monza':              { name: 'Autodromo di Monza',      type: 'Permanent',  image: 'Monza.png' },
  'Sakhir':             { name: 'Bahrain International',   type: 'Permanent',  image: 'Sakhir.png' },
  'Shanghai':           { name: 'Shanghai International',  type: 'Permanent',  image: 'Shanghai.png' },
  'Silverstone':        { name: 'Silverstone',             type: 'Permanent',  image: 'Silverstone.png' },
  'Singapore':          { name: 'Marina Bay Street Circuit', type: 'Street',   image: 'Singapore.png' },
  'Spa-Francorchamps':  { name: 'Circuit de Spa',          type: 'Permanent',  image: 'Spa-Francorchamps.png' },
  'Spielberg':          { name: 'Red Bull Ring',           type: 'Permanent',  image: 'Spielberg.png' },
  'Suzuka':             { name: 'Suzuka International',    type: 'Permanent',  image: 'Suzuka.png' },
  'Yas Marina Circuit': { name: 'Yas Marina Circuit',      type: 'Permanent',  image: 'Yas-Marina-Circuit.png' },
  'Zandvoort':          { name: 'Circuit Zandvoort',       type: 'Permanent',  image: 'Zandvoort.png' },
};

function circuitImageUrl(shortName) {
  const file = CIRCUIT_INFO[shortName]?.image;
  return file ? `${GITHUB_RAW_BASE}/${file}` : null;
}

function circuitName(shortName) {
  return CIRCUIT_INFO[shortName]?.name ?? shortName;
}

function circuitType(shortName) {
  return CIRCUIT_INFO[shortName]?.type ?? null;
}

// driver_number → display name shown in the standings column
const DRIVER_DISPLAY = {
   1: 'L. Norris',
   3: 'M. Verstappen',
   5: 'G. Bortoleto',
   6: 'I. Hadjar',
  10: 'P. Gasly',
  11: 'S. Pérez',
  12: 'K. Antonelli',
  14: 'F. Alonso',
  16: 'C. Leclerc',
  18: 'L. Stroll',
  23: 'A. Albon',
  27: 'N. Hülkenberg',
  30: 'L. Lawson',
  31: 'E. Ocon',
  41: 'A. Lindblad',
  43: 'F. Colapinto',
  44: 'L. Hamilton',
  55: 'C. Sainz',
  63: 'G. Russell',
  77: 'V. Bottas',
  81: 'O. Piastri',
  87: 'O. Bearman',
};

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
      month: d.getMonth(),                                              // UTC month (close enough for range)
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

function determineView(sessions) {
  if (sessions.some(s => s.status === 'live'))                                        return 'live';
  if (sessions.some(s => s.session_name === 'Race' && s.status === 'completed'))      return 'post_race';
  if (sessions.some(s => s.status === 'completed'))                                   return 'race_weekend';
  return 'pre_weekend';
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
            name: wdc?.full_name ?? DRIVER_DISPLAY[wdc?.driver_number] ?? '',
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
            name: DRIVER_DISPLAY[d.driver_number] ?? `#${d.driver_number}`,
            points: d.points_current ?? 0,
            portrait_url: d.portrait_url ?? null,
          })),
          drivers_col2: drivers.slice(11).map(d => ({
            position: d.position_current,
            name: DRIVER_DISPLAY[d.driver_number] ?? `#${d.driver_number}`,
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

    const view = determineView(sessions);

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
      sessions: sessions.map(s => ({
        day: sessionDateParts(s.date_start, timezone).day,
        month: sessionDateParts(s.date_start, timezone).month,
        name: s.session_name,
        time_range: `${formatTime(s.date_start, timezone)} – ${formatTime(s.date_end, timezone)}`,
        status: s.status,
        weather: sessionWeather(s, weather, forecasts),
      })),
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
            name: DRIVER_DISPLAY[d.driver_number] ?? `#${d.driver_number}`,
            points: d.points_current ?? 0,
          })),
      },
    };

    if (last_session?.results?.length) {
      payload.last_session = {
        name: `${last_session.session_name} Results`,
        results: last_session.results.map(r => ({
          position: r.position,
          name: DRIVER_DISPLAY[r.driver_number] ?? `#${r.driver_number}`,
          portrait_url: r.portrait_url,
          compounds: r.compounds,
          time: r.position === 1 ? formatLapTime(r.duration) : formatGap(r.gap_to_leader),
        })),
      };
    }

    if (view === 'post_race' && last_session?.results?.length) {
      const p1 = last_session.results[0];
      const gridResult = qualifying_results?.find(r => r.driver_number === p1.driver_number);
      payload.winner = {
        name: p1.full_name ?? DRIVER_DISPLAY[p1.driver_number] ?? `#${p1.driver_number}`,
        team: TEAM_NAMES[DRIVER_MAP[p1.driver_number]?.team] ?? '',
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
