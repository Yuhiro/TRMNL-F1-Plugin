# TRMNL X F1 Plugin

A Formula 1 plugin for the [TRMNL X](https://usetrmnl.com) e-ink display. Shows the current race weekend schedule, session timings, and championship standings — updated every 15 minutes via GitHub Actions.

![Race weekend view showing session list, constructor standings, and driver standings](assets/app.png)

---

## What it shows

**Race weekend view** (active during a GP weekend):
- Session list for the weekend with local times (Practice, Qualifying, Race, Sprint)
- Completed sessions greyed out; upcoming sessions bold; active session marked **LIVE**
- Weather forecast inline with each upcoming session
- Constructor standings (top 5)
- Driver standings (top 5)
- Circuit map, race name, location, and round number

**Post-race view** (shown after the race until the next weekend):
- Race winner with portrait, team, and grid-to-finish position
- "Up Next" block with the next race name, location, date range, and race-day weather forecast

**Off-weekend:** Calendar view showing upcoming races (in progress).

---

## Requirements

- A [TRMNL](https://usetrmnl.com) device (designed for TRMNL X — 1040×780 virtual resolution, 16-level grayscale)
- A GitHub account (to fork this repo and run Actions)
- No API keys required — uses [OpenF1](https://openf1.org) (free) and [Open-Meteo](https://open-meteo.com) (free)

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
| `USER_TIMEZONE` | Your local timezone string, e.g. `America/Toronto` |

Timezone strings follow the [IANA tz database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) format. All session times in the display will be converted to this timezone.

**Variables** (optional, plain text):

| Variable | Values | Default |
|----------|--------|---------|
| `CIRCUIT_IMAGE_SOURCE` | `openf1` or `official` | `openf1` |

Set `CIRCUIT_IMAGE_SOURCE` to `official` to use high-resolution F1 CDN circuit images instead of OpenF1 images. Both sets are committed to the repo — no re-download needed to switch.

### 4. Enable GitHub Actions

GitHub disables Actions on forks by default. Go to **Actions** in your repo and enable them.

The workflow runs on a smart schedule to stay within GitHub Actions free tier limits:
- **Friday–Sunday:** every 30 minutes (race weekend)
- **Monday:** once at noon UTC (post-race standings update)
- **Wednesday:** once at noon UTC (picks up penalty/DSQ point adjustments)
- **Thursday:** once at noon UTC (sprint weekend Thursday sessions)
- **Tuesday:** not scheduled

You can also trigger it manually from the Actions tab at any time.

---

## How it works

```
GitHub Actions (cron: */15 * * * *)
  └── fetch-data.js       — Fetches OpenF1 + Open-Meteo APIs
  └── build-payload.js    — Transforms data into TRMNL merge_variables JSON
  └── push-webhook.js     — POSTs payload to TRMNL webhook
```

TRMNL receives the payload and renders `template.html` using Liquid templating on the device.

### Data sources

| Source | Used for |
|--------|----------|
| [OpenF1](https://openf1.org) | Season calendar, session times, live weather, standings |
| [Open-Meteo](https://open-meteo.com) | Weather forecasts for upcoming sessions (pre-weekend) |

### Running locally

```bash
node scripts/fetch-data.js | node scripts/build-payload.js | node scripts/push-webhook.js
```

Requires Node.js 22+. No npm dependencies — uses native `fetch` and `Intl`.

Set `TRMNL_WEBHOOK_URL` and `USER_TIMEZONE` as environment variables before running.

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
node scripts/download-circuits.js                  # openf1 only (default)
node scripts/download-circuits.js --source official # F1 CDN only
node scripts/download-circuits.js --source both    # both sources
```

---

## Project structure

```
.github/
  workflows/
    trmnl-update.yml      # Cron schedule + orchestration
scripts/
  fetch-data.js           # Fetches OpenF1 + Open-Meteo, writes JSON to stdout
  build-payload.js        # Transforms raw JSON into TRMNL webhook payload
  push-webhook.js         # POSTs to TRMNL webhook URL
  circuits.js             # Circuit data: coords, names, image filenames, F1 slugs
  download-circuits.js    # One-time utility: downloads circuit images (--source openf1|official|both)
  preview.js              # Local preview server for template.html with fixture data
assets/
  circuits/
    openf1/               # Circuit map PNGs from OpenF1
    official/             # Circuit map WebPs from F1 CDN
  fixtures/               # Sample JSON payloads for local preview
template.html             # Liquid template rendered on the TRMNL device
```
