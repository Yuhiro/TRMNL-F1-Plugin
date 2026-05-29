# TRMNL X F1 Plugin

A Formula 1 plugin for the [TRMNL X](https://usetrmnl.com) e-ink display. Shows the current race weekend schedule, session timings, and championship standings — updated automatically via GitHub Actions.

![Race weekend view showing session list, constructor standings, and driver standings](assets/app.png)

---

## What it shows

**Race weekend view** (active during a GP weekend):
- Session list for the weekend with local times (Practice, Qualifying, Race, Sprint)
- Completed sessions greyed out; upcoming sessions show weather forecasts; active session marked **LIVE**
- Constructor standings (top 6)
- Driver standings (top 6)
- Circuit map, race name, location, and round number

**Post-race view** (shown after the race until the next weekend):
- Race winner with portrait, team, and grid-to-finish position
- "Up Next" block with the next race name, location, date range, and race-day weather forecast
- Constructor and driver standings

**Pre-weekend view** (off-weekend — next GP is upcoming):
- Same template as race weekend, showing the next GP's full session schedule with forecasts
- All sessions shown as upcoming

**Off-season view** (between seasons):
- Season year and WDC/WCC champions with portrait
- Full driver championship standings (all drivers, two columns)
- Full constructor championship standings

---

## Requirements

- A [TRMNL](https://usetrmnl.com) device (designed for TRMNL X — 1040×780 virtual resolution, 16-level grayscale)
- A GitHub account (to fork this repo and run Actions)
- No API keys required — uses [OpenF1](https://openf1.org) (free tier) and [Open-Meteo](https://open-meteo.com) (free)

---

## Setup

### 1. Fork and clone this repo

```bash
git clone https://github.com/your-username/TRMNL-F1-Plugin.git
cd TRMNL-F1-Plugin
```

### 2. Create a Private Plugin in TRMNL

1. Go to **TRMNL Dashboard → Plugins → Private Plugin**
2. Choose **Webhook** as the strategy
3. Copy the **Webhook URL** — you'll need it in the next step
4. Paste the contents of `template.html` into the template editor

### 3. Add GitHub Secrets and Variables

In your forked repo, go to **Settings → Secrets and variables → Actions**.

**Secrets** (encrypted):

| Secret | Value |
|--------|-------|
| `TRMNL_WEBHOOK_URL` | The webhook URL from your TRMNL private plugin |

**Variables** (plain text):

| Variable | Value | Notes |
|----------|-------|-------|
| `USER_TIMEZONE` | e.g. `America/Toronto` | IANA tz format. All session times are converted to this timezone. Required. |
| `CIRCUIT_IMAGE_SOURCE` | `openf1` or `official` | Default: `openf1`. Set to `official` for F1 CDN circuit images. |

Timezone strings follow the [IANA tz database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) format.

### 4. Enable GitHub Actions

GitHub disables Actions on forks by default. Go to **Actions** in your repo and enable them.

The workflow runs on a schedule to stay within GitHub Actions free tier limits:
- **Friday–Sunday:** every 30 minutes (race weekend)
- **Monday:** once at noon UTC (post-race standings update)
- **Wednesday:** once at noon UTC (picks up penalty/DSQ point adjustments)

You can also trigger it manually from the Actions tab at any time.

---

## How it works

```
GitHub Actions (cron schedule)
  └── fetch-data.js       — Fetches OpenF1 + Open-Meteo APIs
  └── build-payload.js    — Transforms data into TRMNL merge_variables JSON
  └── push-webhook.js     — POSTs payload to TRMNL webhook
```

TRMNL receives the payload and renders `template.html` using Liquid templating on the device.

### Data sources

| Source | Used for |
|--------|----------|
| [OpenF1](https://openf1.org) | Season calendar, session times, live weather, standings, driver portraits |
| [Open-Meteo](https://open-meteo.com) | Weather forecasts for upcoming sessions |

### Running locally

```bash
node scripts/fetch-data.js | node scripts/build-payload.js | node scripts/push-webhook.js
```

Requires Node.js 22+. No npm dependencies — uses native `fetch` and `Intl`.

Set `TRMNL_WEBHOOK_URL`, `USER_TIMEZONE`, and `GITHUB_REPOSITORY` (format: `owner/repo`) as environment variables before running.

---

## Circuit images

Two sets of circuit images are committed to the repo and served via GitHub raw content URLs:

| Folder | Source | Format |
|--------|--------|--------|
| `assets/circuits/openf1/` | OpenF1 API | PNG |
| `assets/circuits/official/` | F1 CDN | WebP (higher resolution) |

Which set is used is controlled by the `CIRCUIT_IMAGE_SOURCE` repository variable (see Setup). The default is `openf1`.

To re-download images for a new season (run locally, then commit):

```bash
node scripts/download-circuits.js
```

---

## Project structure

```
.github/
  workflows/
    trmnl-update.yml        # Cron schedule + orchestration
scripts/
  fetch-data.js             # Fetches OpenF1 + Open-Meteo, writes JSON to stdout
  build-payload.js          # Transforms raw JSON into TRMNL webhook payload
  push-webhook.js           # POSTs to TRMNL webhook URL
  circuits.js               # Circuit data: coords, names, image filenames, F1 slugs
  download-circuits.js      # One-time utility: downloads circuit images from OpenF1
  download-assets.js        # One-time utility: downloads driver portrait images
  validate-fixtures.js      # Validates fixture files match the current payload schema
  preview.js                # Local preview server for template.html with fixture data
assets/
  circuits/
    openf1/                 # Circuit map PNGs from OpenF1
    official/               # Circuit map WebPs from F1 CDN
  portraits/                # Driver portrait PNGs (self-hosted, served via GitHub raw URLs)
fixtures/                   # Sample JSON payloads for local preview and validation
template.html               # Liquid template rendered on the TRMNL device
```
