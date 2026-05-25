# TRMNL F1 Plugin — Claude Code Project Instructions

## What We're Building
A TRMNL e-ink display plugin for Formula 1 fans. It shows the current race weekend schedule, session timings with weather, and championship standings. A GitHub Actions workflow fetches data from multiple APIs and pushes it to TRMNL via webhook.

## Current Status
- Design is in Figma (three view states designed: pre-weekend, between sessions, live)
- Architecture and data sources decided
- `scripts/fetch-data.js` and `scripts/build-payload.js` are written and tested
- `push-webhook.js` and `trmnl-update.yml` not yet written

---

## Architecture Overview

### Data Pipeline
GitHub Actions workflow → fetches APIs → pushes JSON payload → TRMNL webhook → Liquid template renders on device

### TRMNL Plugin Type
Private Plugin using **Webhook** strategy (not polling). GitHub Actions pushes data to TRMNL on a schedule.

### Polling Frequency
- **Off-weekend:** Every 15 minutes
- **Race weekend (between sessions):** Every 15 minutes
- **Live session:** Every 30 seconds via a loop inside a single GitHub Actions job
- **Live session detection:** Simple — compare current UTC time against `date_start` and `date_end` from OpenF1 sessions endpoint. If `now >= date_start && now <= date_end`, session is live.

---

## APIs

### OpenF1 (primary)
Base URL: `https://api.openf1.org/v1/`

Key endpoints:
- `/meetings?year=2026` — full season calendar, updates daily at midnight UTC
- `/sessions?meeting_key=latest` — all sessions for a meeting with `date_start`, `date_end`, `session_name`, `session_type`, `gmt_offset`
- `/weather?session_key=latest` — live weather, updates every minute. Fields: `air_temperature`, `track_temperature`, `rainfall`, `humidity`, `wind_speed`, `wind_direction`
- `/championship_drivers?session_key=latest` — driver standings, race sessions only. Fields: `driver_number`, `points_current`, `points_start`, `position_current`, `position_start`
- `/championship_teams?session_key=latest` — **DO NOT USE for 2026**: returns `team_name: null` for all entries. Derive constructor standings from `/championship_drivers` instead (group `points_current` by team using the static `DRIVER_MAP` in `fetch-data.js`)
- `/session_result?session_key=latest` — final results after session. Fields: `position`, `driver_number`, `duration`, `gap_to_leader`, `dnf`, `dns`, `dsq`

**Important:** Real-time data requires a paid OpenF1 subscription. Historical data (2023+) is free. Plan accordingly.

### Open-Meteo (weather forecasts, pre-weekend)
Base URL: `https://api.open-meteo.com/v1/forecast`
No API key required. Use for forecasting qualifying and race day weather before the weekend starts.
Example: `?latitude=45.5&longitude=-73.52&daily=temperature_2m_max,precipitation_probability_max,weathercode&timezone=America/Toronto`

Map `weathercode` to Tabler Icons for display (see CONTEXT.md).

---

## View States

### 1. Calendar View (default, off-weekend)
Shows upcoming races. Not yet designed in detail — focus has been on the race weekend view.

### 2. Race Weekend View (during a GP weekend)
**Left column:** Session list for the weekend
- Completed sessions: greyed out, no weather shown
- Upcoming sessions: bold, show weather inline
- Live session: normal weight + **LIVE pill badge** (black filled, white text, `rounded--full`)
- Weather format: `21°C · ☁ 20%` using Tabler Icons via CDN, dot separator between fields

**Right column:** Two sub-columns
- Left: Constructor standings (team short form + points)
- Right: Driver standings (abbreviated name + points)

**Header:** Track map image + Race name + Location with Round number + Date range (Image 2 layout — track map beside title, not floating top-right). Format: `Montréal, Canada (Round 7)`

### 3. Post-Race View
TBD — likely reverts to calendar view with a small last-race summary. Not designed yet.

### 4. Live Session View
**Kept simple for now.** No separate live view. Just mark the active session row with a LIVE badge. No special data fetching or live timing display during sessions for this version.

---

## TRMNL Framework Rules (v3.1)
Always use framework classes — never raw inline CSS or hardcoded hex values.

**Structure:**
```html
<div class="layout">
  <!-- content here -->
</div>
<!-- title_bar is OPTIONAL — we are NOT using it to maximise screen space -->
```

**Typography classes:**
- `text--small` (12px), `text--base` (16px), `text--large` (21px), `text--xlarge` (26px+)
- `font--bold` for bold weight
- `title`, `title--small`, `title--large` for headings
- `label`, `label--small`, `label--filled`, `label--outline`, `label--underline` for labels
- `description` for secondary text

**Item component:**
```html
<div class="item item--emphasis-3">
  <div class="meta"></div>
  <div class="content">...</div>
</div>
```
Emphasis levels 1–3 progressively darken the left meta bar.

**Layout utilities:** `flex`, `flex--row`, `flex--col`, `flex--between`, `flex--center-y`, `gap--small`, `gap--xsmall`, `columns`, `column`

**Rounded:** `rounded--full` (pill), `rounded--small` (7px), `rounded` (10px), `rounded--large` (20px)

**Background:** Use framework background utilities, not raw CSS colours.

**Colours (2-bit greyscale only):**
- `#FFFFFF` — background
- `#000000` — foreground, borders, filled elements
- `#888888` — secondary/muted text
- `#CCCCCC` — dividers

**Icons:** Tabler Icons via CDN (not bundled in framework):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
<i class="ti ti-cloud-rain"></i>
```

**Font note:** TRMNL pixel fonts (TRMNL12/16/21) render on the physical device. Use framework text size classes, not raw font-size CSS.

---

## User Settings
The plugin requires one user-configurable setting:

| Field | Type | Description |
|---|---|---|
| `timezone` | String | Standard timezone string e.g. `America/Toronto`, `America/Vancouver`, `Europe/London` |

All session times in the webhook payload must be converted to the user's timezone before pushing. The GitHub Actions script handles this conversion using the stored timezone setting.

---

## GitHub Actions Workflow Structure
```
.github/
  workflows/
    trmnl-update.yml    # Cron schedule + orchestration
scripts/
  fetch-data.js         # Fetches OpenF1 + Open-Meteo
  build-payload.js      # Transforms data into TRMNL webhook payload
  push-webhook.js       # POSTs to TRMNL webhook URL
```

**Secrets required (stored in GitHub repo secrets):**
- `TRMNL_WEBHOOK_URL`
- `USER_TIMEZONE` (e.g. `America/Toronto`)

**Cron schedule:**
```yaml
on:
  schedule:
    - cron: '*/15 * * * *'
```

During live sessions, loop inside the job at 30-second intervals instead of relying on cron.

---

## Data Conventions

### Driver short codes (2026 season)
ANT, RUS, NOR, PIA, LEC, HAM, VER, HAD, ALO, STR, GAS, COL, HUL, BOR, SAI, ALB, LAW, LIN, BEA, OCO, PER, BOT

### Team short codes (2026 season)
MCL, MER, FER, RBR, AMR, ALP, AUD, WIL, RBU, HAA, CAD

### Session name values from OpenF1
`Practice 1`, `Practice 2`, `Practice 3`, `Sprint Qualifying`, `Sprint`, `Qualifying`, `Race`

### Weather icon mapping (Open-Meteo weathercode → Tabler Icon)
See CONTEXT.md for full mapping table.

---

## Key Design Decisions Made
- No title_bar — maximise screen real estate
- Track map always to the LEFT of the header title block (consistent across all views)
- Round number always shown in the location line: `Montréal, Canada (Round 7)`
- Completed sessions greyed out, no weather
- Live = LIVE badge only, no separate view
- Dot separator (·) between weather fields
- Constructor standings left, driver standings right
- Constructor standings full team names (e.g. "Mercedes", not "MER")
- Driver standings abbreviated: first initial + surname (e.g. "K. Antonelli")
- Post-race view not yet designed
- Tabler Icons for weather (loaded via CDN)
- Open-Meteo for pre-weekend forecasts, OpenF1 `air_temperature` + `rainfall` during live sessions
- Live session weather format: `21°C · icon · Wet/Dry` (same template fields as forecast, `rainfall` boolean → "Wet"/"Dry")
- All times converted to user timezone in `build-payload.js` (timezone travels in the JSON from `fetch-data.js`)
- Pure Node.js — no npm dependencies. Uses native `fetch` (Node 18+) and `Intl` for timezone formatting

## What's Not Built Yet
- [ ] GitHub Actions workflow (`trmnl-update.yml`)
- [x] Data fetching scripts (`scripts/fetch-data.js`)
- [x] Webhook payload builder (`scripts/build-payload.js`)
- [ ] Webhook pusher (`scripts/push-webhook.js`)
- [ ] Liquid template (all view states)
- [ ] Calendar view design
- [ ] Post-race view design
- [ ] Circuit static data (lap record, corners, DRS zones, length) — to be added to CSV

## Role
Think like a software engineer and ux designer. Ask questions if you have them.