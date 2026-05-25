# TRMNL F1 Plugin — Claude Code Project Instructions

## What We're Building
A TRMNL e-ink display plugin for Formula 1 fans. It shows the current race weekend schedule, session timings with weather, and championship standings. A GitHub Actions workflow fetches data from multiple APIs and pushes it to TRMNL via webhook.

## Current Status
- Design is in Figma (three view states designed: pre-weekend, between sessions, live)
- Architecture and data sources decided
- All pipeline scripts written and tested (`fetch-data.js`, `build-payload.js`, `push-webhook.js`)
- GitHub Actions workflow written (`trmnl-update.yml`)
- Race weekend `template.html` written and iterating on layout/rendering
- 23 circuit map images downloaded to `assets/circuits/` and committed to the repo

---

## Device

**User's device: TRMNL X**

| Spec | Value |
|---|---|
| Physical resolution | 1872 × 1404 px |
| Virtual render size | 1040 × 780 px (pixel-ratio: 1.8) |
| Display | 10.3" ePaper, landscape |
| Color depth | 4-bit / 16 grayscale levels |
| Framework CSS class | `screen--v2` |
| Full refresh | ≤ 1.2s |

The standard TRMNL OG is 800×480 / 2-bit. The TRMNL X is significantly larger and higher-resolution. 16 grayscale levels means intermediate grays render faithfully — subtle shading and muted text look correct without dithering artefacts.

---

## Architecture Overview

### Data Pipeline
GitHub Actions workflow → fetches APIs → pushes JSON payload → TRMNL webhook → Liquid template renders on device

### TRMNL Plugin Type
Private Plugin using **Webhook** strategy (not polling). GitHub Actions pushes data to TRMNL on a schedule.

### Polling Frequency
- **Off-weekend:** Every 15 minutes (cron)
- **Race weekend (between sessions):** Every 15 minutes (cron)
- **Live session:** Every 15 minutes — a 30-second loop was considered but dropped. TRMNL rate limits pushes to 12/hour (free) or 30/hour (TRMNL+); a 30s loop would require 120/hour.

---

## APIs

### OpenF1 (primary)
Base URL: `https://api.openf1.org/v1/`

Key endpoints:
- `/meetings?year={year}` — full season calendar, updates daily at midnight UTC
- `/sessions?meeting_key={key}` — all sessions for a meeting with `date_start`, `date_end`, `session_name`, `session_type`, `gmt_offset`
- `/weather?session_key={key}` — live weather, updates every minute. Fields: `air_temperature`, `track_temperature`, `rainfall`, `humidity`, `wind_speed`, `wind_direction`
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
- Completed sessions: greyed out (`text--muted`), no weather shown
- Upcoming sessions: bold (`font--bold`), show weather inline
- Live session: bold + **LIVE pill badge** (`label label--small label--filled rounded--full`)
- Weather format: `21°C · ☁ 20%` using Tabler Icons via CDN, dot separator between fields

**Right column:** Two sub-columns
- Left: Constructor standings (full team name + points), top 5
- Right: Driver standings (first initial + surname + points), top 5

**Header:** Track map image + Race name + Location with Round number + Date range. Circuit map to the LEFT of the title block. Format: `Montréal, Canada (Round 7)`

### 3. Post-Race View
TBD — likely reverts to calendar view with a small last-race summary. Not designed yet.

### 4. Live Session View
**Kept simple for now.** No separate live view. Just mark the active session row with a LIVE badge. No special data fetching or live timing display during sessions for this version.

---

## TRMNL Framework Rules (v3.1)

### Layout structure
```html
<div class="layout layout--col layout--justify-start layout--stretch-x" style="padding: var(--gap-xxlarge);">
  <!-- content here -->
</div>
<!-- title_bar is OPTIONAL — we are NOT using it to maximise screen space -->
```

**Critical:** `.layout` is `display: flex; flex-direction: row` by default — always add `layout--col` for a top-to-bottom column layout. `layout--justify-start` stacks children from the top. `layout--stretch-x` makes children fill the full width.

**Avoid `flex--row` and `flex--col` utilities for structural containers** — they add `justify-content: center` and `align-items: center` respectively, which causes unwanted centering. Use inline `style="display: flex; flex-direction: row/column; ..."` for structural flex containers inside the layout, and reserve `flex--row`/`flex--col` for simple leaf-level alignment where centering is intentional.

**Gap CSS variables (use these in inline styles, not hardcoded px):**
- `var(--gap-xsmall)` — 5px
- `var(--gap-small)` — 7px
- `var(--gap)` — 10px
- `var(--gap-medium)` — 16px
- `var(--gap-large)` — 20px
- `var(--gap-xlarge)` — 30px
- `var(--gap-xxlarge)` — 40px

**Layout modifier classes:**
- `layout--col` / `layout--row` — flex direction
- `layout--justify-start` / `layout--justify-center` / `layout--justify-end` — main axis alignment
- `layout--align-start` / `layout--align-center` / `layout--align-end` — cross axis alignment
- `layout--stretch-x` — all direct children stretch to full width (column layouts)
- `layout--stretch-y` — all direct children stretch to full height (row layouts)

### Typography classes
- `text--small` (12px), `text--base` (16px), `text--large` (21px), `text--xlarge` (26px+), `text--xxlarge` (38px)
- `font--bold` for bold weight
- `text--muted` for secondary/muted text
- `label`, `label--small`, `label--filled`, `label--outline`, `label--underline` for labels

### Rounded
`rounded--full` (pill), `rounded--small` (7px), `rounded` (10px), `rounded--large` (20px)

### Colours
The TRMNL X supports **4-bit / 16 grayscale levels**. Use framework CSS variables, not hardcoded hex:
- `var(--light-grey)` — dividers, borders
- `var(--mid-grey)` — secondary elements
- `text--muted` class — muted/secondary text

Do not hardcode `#CCCCCC`, `#888888`, etc. — always use the CSS variable equivalents.

### Icons
Tabler Icons via CDN (not bundled in framework):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
<i class="ti ti-cloud-rain"></i>
```

### Font note
TRMNL pixel fonts (TRMNL12/16/21) render on the physical device. Use framework text size classes, not raw font-size CSS.

---

## Circuit Images
Circuit map PNGs are hosted in the GitHub repo at `assets/circuits/`. The `build-payload.js` constructs GitHub raw URLs (`https://raw.githubusercontent.com/yuhiro/TRMNL-F1-Plugin/main/assets/circuits/{name}.png`) and includes them in the payload. Images must be committed to the repo for the URLs to resolve.

`scripts/download-circuits.js` is a one-time utility to download images from OpenF1 for a new season. Re-run it when new circuits are added.

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
  fetch-data.js         # Fetches OpenF1 + Open-Meteo, writes JSON to stdout
  build-payload.js      # Transforms raw JSON into TRMNL webhook payload
  push-webhook.js       # POSTs to TRMNL webhook URL
  download-circuits.js  # One-time utility: downloads circuit images from OpenF1
assets/
  circuits/             # 23 circuit map PNGs (committed to repo)
```

**Secrets required (stored in GitHub repo secrets):**
- `TRMNL_WEBHOOK_URL`
- `USER_TIMEZONE` (e.g. `America/Toronto`)

**Run command:**
```bash
node scripts/fetch-data.js | node scripts/build-payload.js | node scripts/push-webhook.js
```

**Cron schedule:** `*/15 * * * *` (every 15 minutes)

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
- Completed sessions greyed out (`text--muted`), no weather
- Live = LIVE badge only, no separate view, no live loop
- Dot separator (·) between weather fields
- Constructor standings left, driver standings right, top 5 each
- Constructor standings full team names (e.g. "Mercedes", not "MER")
- Driver standings abbreviated: first initial + surname (e.g. "K. Antonelli")
- Post-race view not yet designed
- Tabler Icons for weather (loaded via CDN)
- Open-Meteo for pre-weekend forecasts, OpenF1 `air_temperature` + `rainfall` during live sessions
- Live session weather format: `21°C · icon · Wet/Dry` (same template fields as forecast, `rainfall` boolean → "Wet"/"Dry")
- All times converted to user timezone in `build-payload.js` (timezone travels in the JSON from `fetch-data.js`)
- Pure Node.js — no npm dependencies. Uses native `fetch` (Node 18+) and `Intl` for timezone formatting
- Circuit images hosted in GitHub repo (`assets/circuits/`), referenced via raw GitHub URLs

## What's Not Built Yet
- [ ] Calendar view design + template
- [ ] Post-race view design + template
- [ ] Circuit static data (lap record, corners, DRS zones, length) — to be added to CSV

## What's Built
- [x] `scripts/fetch-data.js` — fetches OpenF1 + Open-Meteo
- [x] `scripts/build-payload.js` — transforms data into TRMNL payload
- [x] `scripts/push-webhook.js` — POSTs to TRMNL webhook
- [x] `scripts/download-circuits.js` — one-time circuit image downloader
- [x] `.github/workflows/trmnl-update.yml` — 15-minute cron pipeline
- [x] `template.html` — race weekend view (iterating on layout)
- [x] `assets/circuits/` — 23 circuit PNGs

## Role
Think like a software engineer and ux designer. Ask questions if you have them.
