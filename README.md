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

### 3. Add GitHub Secrets

In your forked repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `TRMNL_WEBHOOK_URL` | The webhook URL from your TRMNL private plugin |
| `USER_TIMEZONE` | Your local timezone string, e.g. `America/Toronto` |

Timezone strings follow the [IANA tz database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) format. All session times in the display will be converted to this timezone.

### 4. Enable GitHub Actions

GitHub disables Actions on forks by default. Go to **Actions** in your repo and enable them.

The workflow runs on a smart schedule to stay within GitHub Actions free tier limits:
- **Friday–Sunday:** every 15 minutes (race weekend)
- **Monday:** once at noon UTC (post-race standings update)
- **Tuesday–Thursday:** not scheduled (off-weekend)

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

23 circuit map PNGs live in `assets/circuits/` and are committed to the repo. `build-payload.js` constructs GitHub raw content URLs pointing to these files, so they must be committed and pushed before they'll appear on the device.

To refresh images for a new season:

```bash
node scripts/download-circuits.js
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
  download-circuits.js    # One-time utility: downloads circuit images
assets/
  circuits/               # 23 circuit map PNGs
template.html             # Liquid template rendered on the TRMNL device
```
