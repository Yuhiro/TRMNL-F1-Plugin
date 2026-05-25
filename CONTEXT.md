# TRMNL F1 Plugin — Research & Reference Data

## 2026 Season Info
- **22 races** across **11 teams** (Cadillac joined as 11th constructor)
- **6 sprint weekends:** China, Miami, Canada, Great Britain, Netherlands, Singapore
- Bahrain and Saudi Arabia were cancelled from the original schedule
- Reigning champion: Lando Norris (McLaren)

---

## 2026 Driver List

| Code | Driver | # | Team |
|---|---|---|---|
| ANT | Kimi Antonelli | 12 | Mercedes |
| RUS | George Russell | 63 | Mercedes |
| NOR | Lando Norris | 1 | McLaren |
| PIA | Oscar Piastri | 81 | McLaren |
| LEC | Charles Leclerc | 16 | Ferrari |
| HAM | Lewis Hamilton | 44 | Ferrari |
| VER | Max Verstappen | 3 | Red Bull |
| HAD | Isack Hadjar | 6 | Red Bull |
| ALO | Fernando Alonso | 14 | Aston Martin |
| STR | Lance Stroll | 18 | Aston Martin |
| GAS | Pierre Gasly | 10 | Alpine |
| COL | Franco Colapinto | 43 | Alpine |
| HUL | Nico Hülkenberg | 27 | Audi |
| BOR | Gabriel Bortoleto | 5 | Audi |
| SAI | Carlos Sainz | 55 | Williams |
| ALB | Alexander Albon | 23 | Williams |
| LAW | Liam Lawson | 30 | Racing Bulls |
| LIN | Arvid Lindblad | 41 | Racing Bulls |
| BEA | Oliver Bearman | 87 | Haas |
| OCO | Esteban Ocon | 31 | Haas |
| PER | Sergio Pérez | 11 | Cadillac |
| BOT | Valtteri Bottas | 77 | Cadillac |

Note: `name_acronym` is also available directly from the OpenF1 `/drivers` endpoint — no need to hardcode if fetching live.

---

## 2026 Team Short Codes

| Short | Full Name |
|---|---|
| MCL | McLaren |
| MER | Mercedes |
| FER | Ferrari |
| RBR | Red Bull |
| AMR | Aston Martin |
| ALP | Alpine |
| AUD | Audi |
| WIL | Williams |
| RBU | Racing Bulls |
| HAA | Haas |
| CAD | Cadillac |

---

## Championship Standings After Canadian GP (Round 7, May 24 2026)

Note: Bahrain and Saudi Arabia are NOT marked `is_cancelled` in the OpenF1 API, so round numbering is sequential 1–24. Canada = Round 7, Monaco = Round 8.

### Constructors (from live API, derived from driver standings)
| Pos | Team | Pts |
|---|---|---|
| 1 | MER | 219 |
| 2 | FER | 147 |
| 3 | MCL | 106 |
| 4 | RBR | 57 |
| 5 | ALP | 35 |
| 6 | HAA | 18 |
| 7 | RBU | 16 |
| 8 | WIL | 6 |
| 9 | AUD | 0 |
| 10 | AMR | 0 |
| 11 | CAD | 0 |

### Drivers (from live API, after Canadian GP)
| Pos | # | Code | Driver | Team | Pts |
|---|---|---|---|---|---|
| 1 | 12 | ANT | Kimi Antonelli | MER | 131 |
| 2 | 63 | RUS | George Russell | MER | 88 |
| 3 | 16 | LEC | Charles Leclerc | FER | 75 |
| 4 | 44 | HAM | Lewis Hamilton | FER | 72 |
| 5 | 1 | NOR | Lando Norris | MCL | 58 |
| 6 | 81 | PIA | Oscar Piastri | MCL | 48 |
| 7 | 3 | VER | Max Verstappen | RBR | 43 |
| 8 | 10 | GAS | Pierre Gasly | ALP | 20 |
| 9 | 87 | BEA | Oliver Bearman | HAA | 18 |
| 10 | 30 | LAW | Liam Lawson | RBU | 16 |

---

## 2026 Race Calendar

| Round | Race | Circuit | Location | Country | Date | Sprint |
|---|---|---|---|---|---|---|
| 1 | Australian GP | Albert Park | Melbourne | Australia | 2026-03-08 | No |
| 2 | Chinese GP | Shanghai International | Shanghai | China | 2026-03-15 | Yes |
| 3 | Japanese GP | Suzuka | Suzuka | Japan | 2026-03-29 | No |
| 4 | Bahrain GP | Bahrain International | Sakhir | Bahrain | 2026-04-12 | No |
| 5 | Saudi Arabian GP | Jeddah Corniche | Jeddah | Saudi Arabia | 2026-04-19 | No |
| 6 | Miami GP | Miami International | Miami | USA | 2026-05-03 | Yes |
| 7 | Canadian GP | Gilles Villeneuve | Montréal | Canada | 2026-05-24 | Yes |
| 8 | Monaco GP | Circuit de Monaco | Monaco | Monaco | 2026-06-07 | No |
| 9 | Spanish GP | Barcelona-Catalunya | Barcelona | Spain | 2026-06-14 | No |
| 10 | Austrian GP | Red Bull Ring | Spielberg | Austria | 2026-06-28 | No |
| 11 | British GP | Silverstone | Silverstone | Great Britain | 2026-07-05 | Yes |
| 12 | Belgian GP | Spa-Francorchamps | Spa | Belgium | 2026-07-19 | No |
| 13 | Hungarian GP | Hungaroring | Budapest | Hungary | 2026-07-26 | No |
| 14 | Dutch GP | Zandvoort | Zandvoort | Netherlands | 2026-08-23 | Yes |
| 15 | Italian GP | Monza | Monza | Italy | 2026-09-06 | No |
| 16 | Spanish GP (Madrid) | Madrid Street Circuit | Madrid | Spain | 2026-09-13 | No |
| 17 | Azerbaijan GP | Baku City Circuit | Baku | Azerbaijan | 2026-09-26 | No |
| 18 | Singapore GP | Marina Bay | Singapore | Singapore | 2026-10-11 | Yes |
| 19 | United States GP | Circuit of the Americas | Austin | USA | 2026-10-25 | No |
| 20 | Mexico City GP | Hermanos Rodríguez | Mexico City | Mexico | 2026-11-01 | No |
| 21 | São Paulo GP | Interlagos | São Paulo | Brazil | 2026-11-08 | No |
| 22 | Las Vegas GP | Las Vegas Strip | Las Vegas | USA | 2026-11-21 | No |
| 23 | Qatar GP | Lusail International | Lusail | Qatar | 2026-11-29 | No |
| 24 | Abu Dhabi GP | Yas Marina | Yas Island | UAE | 2026-12-06 | No |

---

## OpenF1 API — Key Data Structures

### Sessions endpoint
```
GET https://api.openf1.org/v1/sessions?country_name=Belgium&session_name=Sprint%20Qualifying&year=2023
```
```json
{
  "circuit_key": 7,
  "circuit_short_name": "Spa-Francorchamps",
  "country_name": "Belgium",
  "date_end": "2023-07-29T15:35:00+00:00",
  "date_start": "2023-07-29T15:05:00+00:00",
  "gmt_offset": "02:00:00",
  "is_cancelled": false,
  "location": "Spa-Francorchamps",
  "meeting_key": 1216,
  "session_key": 9140,
  "session_name": "Sprint Qualifying",
  "session_type": "Sprint Qualifying",
  "year": 2023
}
```

### Meetings endpoint
```
GET https://api.openf1.org/v1/meetings?year=2026&country_name=Singapore
```
```json
{
  "circuit_key": 61,
  "circuit_info_url": "https://api.multiviewer.app/api/v1/circuits/61/2026",
  "circuit_image": "https://media.formula1.com/content/dam/fom-website/...",
  "circuit_short_name": "Singapore",
  "circuit_type": "Temporary - Street",
  "country_name": "Singapore",
  "date_end": "2026-10-11T14:00:00+00:00",
  "date_start": "2026-10-09T09:30:00+00:00",
  "gmt_offset": "08:00:00",
  "is_cancelled": false,
  "location": "Marina Bay",
  "meeting_key": 1296,
  "meeting_name": "Singapore Grand Prix",
  "year": 2026
}
```

Note: `circuit_image` URLs are hosted on F1's CDN and may have referrer restrictions. `circuit_info_url` points to MultiViewer's circuit geometry data — useful for generating track map SVGs but requires additional processing.

**API quirks discovered in 2026 data:**
- `meeting.location` for Monaco is `"Monte Carlo"` (not `"Monaco"`) — use this key in `CIRCUIT_COORDS`
- `championship_teams` endpoint returns `team_name: null` for all 2026 entries — do not use it. Derive constructor standings by summing `points_current` from `championship_drivers`, grouped by team via the static `DRIVER_MAP`
- Round numbers are not provided by the API. Derive by sorting non-cancelled meetings chronologically and using 1-based index. Bahrain and Saudi Arabia are NOT flagged `is_cancelled` in the API, so the full 24-round sequence is used

### Weather endpoint
```
GET https://api.openf1.org/v1/weather?session_key=latest
```
```json
{
  "air_temperature": 27.8,
  "date": "2023-05-07T18:42:25.233000+00:00",
  "humidity": 58,
  "meeting_key": 1208,
  "pressure": 1018.7,
  "rainfall": 0,
  "session_key": 9078,
  "track_temperature": 52.5,
  "wind_direction": 136,
  "wind_speed": 2.4
}
```

### Championship drivers endpoint (race sessions only)
```json
{
  "driver_number": 4,
  "meeting_key": 1276,
  "points_current": 423,
  "points_start": 408,
  "position_current": 1,
  "position_start": 1,
  "session_key": 9839
}
```
`points_current - points_start` = points gained this weekend (useful for delta indicators).

### Session result endpoint
```json
{
  "dnf": false,
  "dns": false,
  "dsq": false,
  "driver_number": 1,
  "duration": 77.565,
  "gap_to_leader": 0,
  "number_of_laps": 24,
  "position": 1,
  "session_key": 7782
}
```
Available a few minutes after official results published. `duration` is best lap time for qualifying/practice, total race time for races.

---

## Open-Meteo Weather Codes → Tabler Icons

| WMO Code | Condition | Tabler Icon |
|---|---|---|
| 0 | Clear sky | `ti-sun` |
| 1, 2 | Partly cloudy | `ti-cloud-sun` |
| 3 | Overcast | `ti-cloud` |
| 45, 48 | Fog | `ti-mist` |
| 51, 53, 55 | Drizzle | `ti-cloud-drizzle` |
| 61, 63, 65 | Rain | `ti-cloud-rain` |
| 71, 73, 75 | Snow | `ti-snowflake` |
| 80, 81, 82 | Rain showers | `ti-cloud-rain` |
| 95 | Thunderstorm | `ti-cloud-storm` |
| 96, 99 | Thunderstorm with hail | `ti-bolt` |

---

## Weather Display Format
```
21°C · <icon> 20%
```
Dot separator between temperature, weather icon, and precipitation probability.

**Live session (OpenF1 trackside data):**
```
21°C · <icon> Wet/Dry
```
Uses `air_temperature` (rounded) for temp. `rainfall` is an integer (0 or 1) — map to "Wet"/"Dry". Icon: `ti-cloud-rain` if wet, `ti-sun` if dry. Same template fields as forecast weather — no separate display logic needed.

---

## TRMNL Framework — Icon Usage
Tabler Icons are not bundled in the framework. Load via CDN at the top of your markup:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
```
Usage:
```html
<i class="ti ti-cloud-rain"></i>
<i class="ti ti-sun"></i>
```

---

## TRMNL Framework — Item Component for Session Rows
```html
<!-- Completed session (greyed out via opacity or text--color utility) -->
<div class="item">
  <div class="meta"></div>
  <div class="content">
    <span class="title title--small text--muted">Practice 1</span>
    <span class="description">12:30 – 13:30</span>
  </div>
</div>

<!-- Live session -->
<div class="item item--emphasis-3">
  <div class="meta"></div>
  <div class="content">
    <div class="flex flex--row flex--between flex--center-y">
      <span class="title title--small">Sprint Qualifying</span>
      <span class="label label--small label--filled rounded--full">LIVE</span>
    </div>
    <span class="description">16:30 – 17:14 · 21°C · <i class="ti ti-cloud"></i> 20%</span>
  </div>
</div>

<!-- Upcoming session -->
<div class="item">
  <div class="meta"></div>
  <div class="content">
    <span class="title title--small">Sprint</span>
    <span class="description">12:30 – 13:30 · 21°C · <i class="ti ti-cloud"></i> 20%</span>
  </div>
</div>
```

---

## Figma Design Resources
- TRMNL mockup PSDs (device frames): https://github.com/usetrmnl/mockups (links to Google Drive in README)
- Can be opened free at photopea.com
- Canvas size: 800 × 480px, white background
- No official Figma community file exists — use raw frames

## Design State: Canadian GP Weekend (reference)
The design was iterated during this conversation using the Canadian GP as the example weekend.
Final agreed layout (Image 2) has:
- Track map + race name + location with round number + date in a unified header block. Location format: `Montréal, Canada (Round 7)`
- Session list on the left (~55% width)
- Constructor standings + driver standings on the right (~45% width), two sub-columns
- Completed sessions greyed out, no weather
- Upcoming sessions bold, weather inline with dot separators
- LIVE badge (filled black pill) on the currently active session

---

## Webhook Payload Schema

`build-payload.js` outputs this structure (consumed by the Liquid template via TRMNL `merge_variables`):

```json
{
  "view": "pre_weekend | race_weekend | live",
  "meeting": {
    "name": "Monaco Grand Prix",
    "location": "Monte Carlo, Monaco",
    "round": 8,
    "circuit_name": "Monte Carlo",
    "circuit_image_url": "https://...",
    "date_range": "Jun 5–7"
  },
  "sessions": [
    {
      "day": "5",
      "month": "Jun",
      "name": "Practice 1",
      "time_range": "07:30 – 08:30",
      "status": "completed | upcoming | live",
      "weather": { "temp": "26°C", "icon": "ti-sun", "precip": "17%" }
    }
  ],
  "standings": {
    "constructors": [{ "position": 1, "name": "Mercedes", "points": 219 }],
    "drivers":      [{ "position": 1, "name": "K. Antonelli", "points": 131 }]
  }
}
```

`weather` is `null` for completed sessions. `precip` is a percentage string for forecasts ("17%") and "Wet"/"Dry" for live sessions.

---

## Things Not Yet Decided / Built
- Circuit static data (lap record, corner count, DRS zones, circuit length) — to be added to calendar CSV later
- Post-race view design
- Calendar view design (off-weekend)
- Whether to show a "last race" summary row anywhere
- Whether to pursue OpenF1 paid subscription for real-time data
