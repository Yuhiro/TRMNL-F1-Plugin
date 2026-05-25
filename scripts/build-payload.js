#!/usr/bin/env node
// Reads raw JSON from fetch-data.js (stdin), outputs TRMNL-ready merge_variables JSON.
// Usage: node scripts/fetch-data.js | node scripts/build-payload.js

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/yuhiro/TRMNL-F1-Plugin/main/assets/circuits';

// circuit_short_name → filename in assets/circuits/ (only circuits with a downloaded image)
const CIRCUIT_IMAGES = {
  'Austin':             'Austin.png',
  'Baku':               'Baku.png',
  'Hungaroring':        'Hungaroring.png',
  'Interlagos':         'Interlagos.png',
  'Jeddah':             'Jeddah.png',
  'Las Vegas':          'Las-Vegas.png',
  'Lusail':             'Lusail.png',
  'Madring':            'Madring.png',
  'Melbourne':          'Melbourne.png',
  'Mexico City':        'Mexico-City.png',
  'Miami':              'Miami.png',
  'Monte Carlo':        'Monte-Carlo.png',
  'Montreal':           'Montreal.png',
  'Monza':              'Monza.png',
  'Sakhir':             'Sakhir.png',
  'Shanghai':           'Shanghai.png',
  'Silverstone':        'Silverstone.png',
  'Singapore':          'Singapore.png',
  'Spa-Francorchamps':  'Spa-Francorchamps.png',
  'Spielberg':          'Spielberg.png',
  'Suzuka':             'Suzuka.png',
  'Yas Marina Circuit': 'Yas-Marina-Circuit.png',
  'Zandvoort':          'Zandvoort.png',
};

function circuitImageUrl(shortName) {
  const file = CIRCUIT_IMAGES[shortName];
  return file ? `${GITHUB_RAW_BASE}/${file}` : null;
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
  if (code === 0)                          return 'ti-sun';
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
    return `${first.monthName} ${Math.min(...days)}–${Math.max(...days)}`;
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

function determineView(sessions) {
  if (sessions.some(s => s.status === 'live'))      return 'live';
  if (sessions.some(s => s.status === 'completed')) return 'race_weekend';
  return 'pre_weekend';
}

function main() {
  let raw = '';
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    const data = JSON.parse(raw);
    const timezone = data.timezone || process.env.USER_TIMEZONE || 'UTC';
    const { meeting, sessions, weather, forecasts, standings } = data;

    const view = determineView(sessions);

    const payload = {
      view,
      meeting: {
        name: meeting.meeting_name,
        location: `${meeting.location}, ${meeting.country_name}`,
        round: meeting.round_number,
        circuit_name: meeting.circuit_short_name,
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
          .slice(0, 5)
          .map(c => ({
            position: c.position,
            name: TEAM_NAMES[c.team] ?? c.team,
            points: c.points,
          })),
        drivers: standings.drivers
          .sort((a, b) => (a.position_current ?? 99) - (b.position_current ?? 99))
          .slice(0, 5)
          .map(d => ({
            position: d.position_current ?? 0,
            name: DRIVER_DISPLAY[d.driver_number] ?? `#${d.driver_number}`,
            points: d.points_current ?? 0,
          })),
      },
    };

    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  });
}

main();
