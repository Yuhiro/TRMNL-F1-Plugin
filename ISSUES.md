# Issues Tracker

## Bugs / Crashes

- [x] **#1 [HIGH] `build-payload.js` crashes at end of season** — `meeting` can be `null` when `off_weekend` and the season is over. `meeting.meeting_name` throws immediately at `build-payload.js:195`. Needs null guard at top of `main()`.

- [x] **#2 [HIGH] Weathercode icon wrong for WMO codes 1–2** — `build-payload.js:90` maps `code <= 2` to `ti-sun` (clear sky). CONTEXT.md specifies codes 1–2 are "Partly cloudy" → `ti-cloud-sun`. Fix: `code === 0` → `ti-sun`, `code <= 2` → `ti-cloud-sun`.

- [x] **#3 [MEDIUM] `dnf`/`dns`/`dsq` flags silently dropped** — `fetch-data.js` fetches these per result but `build-payload.js` strips them when mapping `last_session.results`. Retired drivers show a blank `time` field instead of "DNF".

- [ ] **#4 [LOW] `sessionDateParts` called twice per session** — `build-payload.js:204–205` constructs `new Date()` twice per session in the map loop. Destructure from a single call: `const { day, month } = sessionDateParts(...)`.

- [ ] **#5 [LOW] `winner.portrait_url` `/1col/` → `/2col/` replacement is fragile** — `build-payload.js:249`. If OpenF1 returns a URL without `/1col/` in the path, the replacement is a silent no-op and the wrong image size is used.

---

## Architecture

- [ ] **#6 [MEDIUM] `view` is dual-sourced** — `fetch-data.js` sends `mode: 'off_weekend' | 'race_weekend'`; `build-payload.js` ignores it and re-derives `view` from session statuses independently. Single source of truth would prevent future divergence.

- [ ] **#7 [MEDIUM] Cron schedule has a Tue–Thu dead zone** — `trmnl-update.yml` runs Mon at noon UTC, then nothing until Fri. Mid-week standings changes (rare but real) go stale for up to 4 days. Add one run/day Tue–Thu without touching rate limits.

- [ ] **#8 [MEDIUM] Weather forecasts fetched sequentially** — `fetch-data.js:244–255` uses `for...of` with `await` inside, fetching one date at a time. `getStandings()` also runs sequentially after. Wrapping in `Promise.all()` would parallelize these and reduce wall time.

---

## Template / Framework

- [ ] **#9 [HIGH] `text--xxxlarge` class doesn't exist in TRMNL framework** — `template.html:12` uses this for the race name. CLAUDE.md documents `text--xxlarge` (38px) as the largest class. Preview CSS stub defines it locally so it looks correct in dev, but the device likely ignores it and falls back to browser default.

- [ ] **#10 [MEDIUM] Hardcoded px values in template** — `gap: 24px` (sessions, `template.html:73`), `gap: 48px` (standings row, `:182`), `gap: 4px` (compounds, `:162`), `border-radius: 4px` (LIVE badge, `:86`). Should use `var(--gap-*)` variables and `rounded--*` framework classes per CLAUDE.md.

- [ ] **#11 [LOW] Tabler Icons CDN unpinned** — `@tabler/icons-webfont@latest` in `template.html:1` and `preview.js:200`. A major version bump could rename icons and break weather display silently. Pin to a specific version (e.g. `@3`).

---

## Data Integrity

- [ ] **#12 [LOW] Static `DRIVER_MAP` breaks for mid-season replacements** — `fetch-data.js:9–32`. Constructor standings derived by mapping `driver_number → team` statically. Reserve driver substitutions attribute points to the wrong team. OpenF1 `/drivers?session_key=latest` has live `team_name` — could replace static map.

- [ ] **#13 [LOW] `buildDateRange` mixes UTC month index and local month name** — `build-payload.js:122–134`. `d.getMonth()` is UTC; the displayed month name uses local timezone. For sessions near midnight UTC in offset timezones (e.g. Australia +10), these can genuinely differ. Use local timezone consistently.
