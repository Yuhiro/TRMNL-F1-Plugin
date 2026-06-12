# TRMNL F1 Plugin — Claude Code Project Instructions

@.claude/rules/dev-conventions.md

## What We're Building
A TRMNL e-ink display plugin for Formula 1 fans. It shows the current race weekend schedule, session timings with weather, and championship standings. A GitHub Actions workflow fetches data from multiple APIs and pushes it to TRMNL via webhook.

## Current Status
- Design is in Figma; all five view states built (off-season, pre-weekend, race-weekend, live, post-race)
- Architecture and data sources decided
- All pipeline scripts written, hardened, and tested (`fetch-data.js`, `build-payload.js`, `push-webhook.js`)
- GitHub Actions workflow written (`trmnl-update.yml`)
- `template.html` complete for race-weekend, off-weekend, off-season, and post-race views
- Circuit images committed to repo in two subdirectories: `assets/circuits/official/` (F1 CDN) and `assets/circuits/openf1/`

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

**Payload size limit: 2KB (2048 bytes)** — measured as the full POST body `{"merge_variables": {...}}`. The user is on the free tier. Exceeding this silently truncates or rejects the push. The off-season payload (22 drivers + 11 constructors + 1 champion portrait URL) currently sits at ~2,008 bytes — 40 bytes of headroom. Any new fields added to the off-season branch must be weighed against this limit.

### Polling Frequency
- **Mon/Wed (off-weekend):** Once at noon UTC
- **Fri–Sun (race weekend):** Every 30 minutes (cron)
- **Live session:** No special live loop — just the 30-minute weekend cadence. A 30-second loop was considered but dropped. TRMNL rate limits pushes to 12/hour (free) or 30/hour (TRMNL+); a 30s loop would require 120/hour.

---

## APIs

### OpenF1 (primary)
Base URL: `https://api.openf1.org/v1/`

Key endpoints:
- `/meetings?year={year}` — full season calendar, updates daily at midnight UTC
- `/sessions?meeting_key={key}` — all sessions for a meeting with `date_start`, `date_end`, `session_name`, `session_type`, `gmt_offset`
- `/weather?session_key={key}` — live weather, updates every minute. Fields: `air_temperature`, `track_temperature`, `rainfall`, `humidity`, `wind_speed`, `wind_direction`
- `/championship_drivers?session_key=latest` — driver standings, race sessions only. Fields: `driver_number`, `points_current`, `points_start`, `position_current`, `position_start`
- `/drivers?session_key=latest` — used to get live `team_name` per driver for constructor standings. Fetched in parallel with `/championship_drivers` inside `getStandings()`. Falls back to static `DRIVER_MAP` per driver if the fetch fails.
- `/session_result?session_key=latest` — final results after session. Fields: `position`, `driver_number`, `duration`, `gap_to_leader`, `dnf`, `dns`, `dsq`

**Important:** Real-time data requires a paid OpenF1 subscription. Historical data (2023+) is free. Plan accordingly.

### Open-Meteo (weather forecasts, pre-weekend)
Base URL: `https://api.open-meteo.com/v1/forecast`
No API key required. Use for forecasting qualifying and race day weather before the weekend starts.
Example: `?latitude=45.5&longitude=-73.52&daily=temperature_2m_max,precipitation_probability_max,weathercode&timezone=America/Toronto`

Map `weathercode` to Tabler Icons for display (see docs/CONTEXT.md).

---

## View States

`output.view` is the single routing field in the JSON payload. The template branches on it.

| `view` value | When | Template branch |
|---|---|---|
| `pre_weekend` | Off-weekend — next GP is upcoming, no sessions started | `{% else %}` (race-weekend template) |
| `race_weekend` | Some sessions completed, race not yet run | `{% else %}` |
| `live` | A session is currently in progress | `{% else %}` |
| `post_race` | Race session completed | `{% else %}` with inner `{% if view == 'post_race' %}` |
| `off_season` | No meetings found for current/next year | `{% if view == 'off_season' %}` |

### Off-Weekend View
**No separate template.** During an off-weekend, `findCurrentMeeting` returns the next upcoming GP and `determineView` returns `pre_weekend`. The race-weekend template renders with all sessions showing as "upcoming" with forecasts. This is exactly the right UX — the user sees the next race's schedule.

### Race Weekend View (during a GP weekend)
**Left column:** Session list for the weekend
- Completed sessions: greyed out (`text--muted`), no weather shown
- Upcoming sessions: show weather inline
- Live session: bold + **LIVE pill badge** (`label label--filled rounded--small`)
- Weather format: `21°C · icon · 20%` using Tabler Icons via CDN, dot separator between fields

**Right column:** Two sub-columns
- Left: Constructor standings (full team name + points), top 6
- Right: Driver standings (first initial + surname + points), top 6

**Header:** Race name (full) + Location with Round number + Date range. Format: `Montréal, Canada (Round 7)`

### Post-Race View
Built. Shows:
- **Winner block:** portrait, name, team, grid → finish position (e.g. P3 → P1)
- **Up Next block:** next GP name, location, date range, race-day weather forecast
- Right column: standings as normal

### Off-Season View
Shows the current season's final championship standings (WDC + WCC winners at top, full standings below). Separate template branch (`{% if view == 'off_season' %}`).

### Live Session View
**Kept simple.** No separate live view. Just mark the active session row with a LIVE badge. No special data fetching or live timing display during sessions for this version.

---

## TRMNL Framework Rules (v3.1)

### Figma fidelity
Implement exactly what Figma shows — nothing more. Never add styles (border-radius, shadows, opacity, padding, margins, colours, font weights) that are not present on the specific Figma node being implemented. When in doubt, read the node's properties directly rather than inferring from context or convention.

When a Figma node has `justify-content: center` on a flex-col, check whether the node also needs `align-self: stretch` to fill its parent's height — without it, the div shrinks to content height and `justify-content: center` has no effect.

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
- `text--small` (12px), `text--base` (16px), `text--large` (21px), `text--xlarge` (26px+), `text--xxlarge` (38px), `text--xxxlarge` (confirmed rendering on device)
- `font--bold` for bold weight
- `text--muted` for secondary/muted text
- `label`, `label--small`, `label--filled`, `label--outline`, `label--underline` for labels

### Rounded
`rounded--none` (0), `rounded--xsmall` (5px), `rounded--small` (7px), `rounded` / `rounded--base` (10px), `rounded--medium` (15px), `rounded--large` (20px), `rounded--xlarge` (25px), `rounded--xxlarge` (30px), `rounded--full` (pill/9999px). Corner-specific variants supported: `rounded-tl--large`, `rounded-t--medium`, etc.

### Colours
The TRMNL X supports **4-bit / 16 grayscale levels**. Use framework CSS variables, not hardcoded hex:
- `var(--light-grey)` — dividers, borders
- `var(--mid-grey)` — secondary elements
- `text--muted` class — muted/secondary text

Do not hardcode `#CCCCCC`, `#888888`, etc. — always use the CSS variable equivalents.

### Icons
Tabler Icons via CDN (not bundled in framework):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.44.0/dist/tabler-icons.min.css">
<i class="ti ti-cloud-rain"></i>
```

### Font note
TRMNL pixel fonts (TRMNL12/16/21) render on the physical device. Use framework text size classes, not raw font-size CSS.

---

## Circuit Images
Circuit map images are hosted in the GitHub repo and served via raw GitHub URLs. Two sources are supported, controlled by the `CIRCUIT_IMAGE_SOURCE` repository variable (Settings → Secrets and variables → Variables):

| Value | Path | Format | Notes |
|---|---|---|---|
| `openf1` (default) | `assets/circuits/openf1/` | PNG | Downloaded from OpenF1 CDN |
| `official` | `assets/circuits/official/` | WebP | Downloaded from F1 official CDN |

`build-payload.js` constructs the URL via `circuitImageUrl(circuit_short_name)`, which reads `CIRCUIT_IMAGE_SOURCE` and falls back to `openf1` if no variable is set or if `official` has no slug for a circuit.

Images must be committed to the repo for the URLs to resolve.

`scripts/download-circuits.js` is a one-time utility to download OpenF1 circuit images for a new season. Re-run it when new circuits are added.

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
  build-payload.js      # Transforms data into TRMNL webhook payload
  push-webhook.js       # POSTs to TRMNL webhook URL
  circuits.js           # Circuit metadata: coords, images, names, F1 slugs, types
  download-circuits.js  # One-time utility: downloads circuit images from OpenF1
  preview.js            # Local dev preview server
assets/
  circuits/
    official/           # F1 CDN circuit images (WebP) — used when CIRCUIT_IMAGE_SOURCE=official
    openf1/             # OpenF1 circuit images (PNG) — default
```

**Secrets required (stored in GitHub repo secrets):**
- `TRMNL_WEBHOOK_URL`

**Repository variables (Settings → Secrets and variables → Variables):**
- `USER_TIMEZONE` (e.g. `America/Toronto`) — not sensitive; stored as a variable, not a secret. Falls back to UTC if unset.
- `CIRCUIT_IMAGE_SOURCE` — `'official'` for F1 CDN images; leave unset for OpenF1 (default)

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
See docs/CONTEXT.md for full mapping table.

---

## Key Design Decisions Made
- No title_bar — maximise screen real estate
- Off-weekend view = race-weekend template showing next GP sessions (all "upcoming") — no separate calendar view needed
- `output.view` is the single routing field; `output.mode` was removed as it was never read downstream
- Round number always shown in the location line: `Montréal, Canada (Round 7)`
- Completed sessions greyed out (`text--muted`), no weather
- Live = LIVE badge only, no separate view, no live loop
- Dot separator (·) between weather fields
- Constructor standings left, driver standings right, top 6 each
- Constructor standings full team names (e.g. "Mercedes", not "MER")
- Driver standings abbreviated: first initial + surname (e.g. "K. Antonelli"), sourced from OpenF1 `broadcast_name` field (format: `"INITIAL SURNAME"`, e.g. `"M VERSTAPPEN"`)
- Post-race view: winner block (portrait, name, team, grid→finish) + "Up Next" next GP block
- Tabler Icons for weather (loaded via CDN) — always use framework text size classes, not hardcoded `font-size`
- Open-Meteo for pre-weekend forecasts, OpenF1 `air_temperature` + `rainfall` during live sessions
- Live session weather format: `21°C · icon · Wet/Dry` (`rainfall` boolean → "Wet"/"Dry")
- Weather forecasts fetched in a single batched Open-Meteo request for the full weekend date range
- All times converted to user timezone in `build-payload.js` (timezone travels in the JSON from `fetch-data.js`)
- Pure Node.js — no npm dependencies. Uses native `fetch` (Node 18+) and `Intl` for timezone formatting
- Circuit images in `assets/circuits/official/` (WebP) and `assets/circuits/openf1/` (PNG); source controlled by `CIRCUIT_IMAGE_SOURCE` repo variable
- OpenF1 portrait URLs contain `/1col/` (small); upgraded to `/2col/` via `upgradePortraitUrl()` in `build-payload.js`


## What's Built
- [x] `scripts/fetch-data.js` — fetches OpenF1 + Open-Meteo, outputs JSON to stdout
- [x] `scripts/build-payload.js` — transforms data into TRMNL webhook payload
- [x] `scripts/push-webhook.js` — POSTs to TRMNL webhook
- [x] `scripts/download-circuits.js` — one-time circuit image downloader (OpenF1)
- [x] `scripts/circuits.js` — circuit metadata (coords, image filenames, F1 slugs, names, types)
- [x] `scripts/preview.js` — local preview server for template iteration
- [x] `scripts/validate-fixtures.js` — checks all fixture files match the current payload schema (`npm run validate`)
- [x] `.github/workflows/trmnl-update.yml` — cron pipeline (15-min during weekends, once daily off-weekend)
- [x] `template.html` — all view states: off-season, pre-weekend, race-weekend, live, post-race
- [x] `assets/circuits/official/` — F1 CDN circuit images (WebP)
- [x] `assets/circuits/openf1/` — OpenF1 circuit images (PNG)

## Common Pitfalls

### Module system: CJS only
No `package.json` with `"type": "module"` exists. Always use `require()` / `module.exports`. ESM `import` crashes before a single line runs.

### Pipeline scope: each script is a separate process
`build-payload.js` cannot access anything from `fetch-data.js` — no shared variables, no `DRIVER_MAP`, no functions. Any data it needs must come through the JSON payload, or be defined/imported in `build-payload.js` itself.

### `view` is set in `fetch-data.js` — `build-payload.js` reads it, never recomputes it
`determineView()` lives in `fetch-data.js`. `build-payload.js` reads `data.view` from stdin.

### Payload mapping: cross-check all fields against `template.html`
When writing a `.map()` in `build-payload.js`, verify every field the template uses is explicitly included. `...spread` is not enough — Liquid only sees what the payload contains. Example failure: `dnf`/`dns`/`dsq` present in fetch-data output but not passed through → blank cells for retired drivers.

### Always filter `is_cancelled` when iterating meetings
Cancelled meetings have past dates and surface as "completed" races if not skipped.
```js
meetings.filter(m => !m.is_cancelled && ...)
```

### Race/Sprint sessions overrun their scheduled `date_end`
`classifySessions` applies `OVERRUN_BUFFER_MS = 30 * 60 * 1000` to Race and Sprint only. Without it the LIVE badge drops mid-race and result fetches fire before the API has data. Do not remove this buffer.

### Gate view-specific fetches on `view`
Compute `view` early (immediately after the main `Promise.all`) so it can gate subsequent fetches. `next_meeting` sessions and the next-race forecast are only needed for `post_race` — fetching them unconditionally is wasted work every other run.

### Run `npm run validate` after renaming payload fields
After any field rename in `build-payload.js`, run `node scripts/validate-fixtures.js` (or `npm run validate`). Fixtures won't error at render time — a stale key just produces blank output. The validator catches this immediately.

### `GITHUB_REPOSITORY` is required for circuit image URLs in the pipeline
`build-payload.js` builds circuit image URLs from `process.env.GITHUB_REPOSITORY` (format: `owner/repo`). In Actions this is injected automatically. For local pipeline runs (`npm run pipeline`), set it in your shell first: `export GITHUB_REPOSITORY=owner/repo`. The `preview.js` server rewrites these URLs to local paths, so preview works without it.

### `circuits.js` keys come from the OpenF1 API, not common sense
Always verify the exact `circuit_short_name` value from the `/meetings` response before adding or renaming a key. Do not guess from geography or convention.

---

## Role
Think like a software engineer and ux designer. Ask questions if you have them.
