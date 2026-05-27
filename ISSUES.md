# Issues Tracker

| Prefix | Category |
|--------|----------|
| `B` | Bug |
| `I` | Inefficiency |
| `D` | Dead / Redundant Code |
| `Q` | Code Quality |
| `T` | Template |
| `M` | Missing / Recommendation |

Priority: 🔴 High · 🟡 Medium · 🟢 Low

---

## Bugs

- [x] B1 🔴 — `download-circuits.js` uses ESM syntax: crashes immediately
  `scripts/download-circuits.js:6–10` — `import` / `import.meta.url` are ESM-only; no `package.json` declares `"type": "module"` so Node throws `SyntaxError` before a single line runs.
  **Fixed:** Converted to `require('fs')` / `require('path')`; removed manual `__dirname` (CJS provides it natively).

- [x] B2 🔴 — `build-payload.js` stdin `'end'` handler: unguarded `JSON.parse` + errors bypass `main().catch()`
  ~~`scripts/build-payload.js:130` — `JSON.parse(raw)` is bare in the event handler. Errors thrown inside async event handlers are not attached to the promise chain returned by `main()`, so they may only log a warning rather than exiting non-zero. If `fetch-data.js` exits mid-stream (partial JSON), the parse throws and no webhook is pushed.~~
  **Fixed:** Wrapped the entire `'end'` body in try/catch; errors write to stderr and `process.exit(1)`.

- [x] B3 🔴 — `next_meeting.sessions` is unsorted when passed to `buildDateRange`
  ~~`scripts/fetch-data.js:358–360` — `nextSessions` comes raw from `getSessions()`, not through `classifySessions()` (which sorts by `date_start`). `buildDateRange` uses `localDates[0]` and `localDates[last]` as range endpoints — out-of-order API responses produce a wrong date range.~~
  **Fixed:** Sort by `date_start` inline when storing in `output.next_meeting.sessions`.

- [x] B4 🟡 — Year-boundary: late January fetches prior season's meetings
  ~~`scripts/fetch-data.js:43` — `getMeetings()` uses `new Date().getFullYear()`. In late January before the new season is published on OpenF1, this returns the prior year's completed races, leading to a spurious `off_season` view.~~
  **Fixed:** If all meetings in the current year are in the past, fetch `year + 1` as a fallback; silently returns current year if the next season isn't published yet.

- [x] B5 🔴 — `circuits.js` key `'Barcelona'` doesn't match OpenF1's `circuit_short_name: 'Madring'`
  `scripts/circuits.js` — OpenF1 returns `circuit_short_name: 'Madring'` for the Circuit de Barcelona-Catalunya. The key was `'Barcelona'`, causing all lookups (weather forecast coords, circuit image, circuit name) to silently miss for the Spanish GP. `'Madrid'` was also a dead entry with no matching OpenF1 circuit.
  **Fixed:** Renamed key to `'Madring'`, updated `image` from `null` to `'Madring.png'`, removed dead `'Madrid'` entry.

---

## Inefficiencies

- [x] I1 🟡 — Open-Meteo: one HTTP call per session date; could be one batched call
  ~~`scripts/fetch-data.js:247–261` — One `getWeatherForecast()` call per unique upcoming session date. Open-Meteo's `/forecast` endpoint accepts `start_date` and `end_date` and returns all days in a single response. A race weekend has at most 3 unique dates.~~
  **Fixed:** Replaced `getWeatherForecast` (single date) with `getWeatherForecasts` (date array → `{ [dateStr]: forecast }` map). One request covers the full weekend; next-race forecast reuses the same function with a single-element array.

- [x] I2 🟢 — `download-circuits.js`: sequential downloads
  ~~`scripts/download-circuits.js:32–49` — `for...of` with `await` downloads images one at a time (~22 sequential requests). Low impact since it's a one-time script.~~
  **Fixed:** Converted to `Promise.allSettled`. Tested live — no rate limiting. Also surfaced the Madring/Barcelona key mismatch (see B5).

---

## Dead / Redundant Code

- [x] D1 🟡 — `output.mode` in `fetch-data.js` is never read downstream
  `scripts/fetch-data.js:224–232` — `output.mode` is set to `'off_weekend'`, `'race_weekend'`, or `'off_season'`, but neither `build-payload.js` nor `template.html` reads it; both read `data.view` instead.
  **Fix:** Remove `output.mode`, or consolidate with `output.view`.

---

## Code Quality

- [x] Q1 🟡 — `portrait_url.replace('/1col/', '/2col/')` is a fragile implicit contract
  `scripts/build-payload.js:149`, `247` — Two places silently depend on OpenF1's CDN URL containing `/1col/`. If that path segment changes, the replacement is a no-op and the display gets the smaller portrait with no error.
  **Fixed:** Extracted `upgradePortraitUrl()` helper with an explanatory comment and a `stderr` warning when `/1col/` is absent. Both call-sites use the helper.

- [x] Q2 🟢 — `formatBroadcastName` input format assumption is undocumented
  `scripts/fetch-data.js:122–129` — Assumes `broadcast_name` is `"INITIAL SURNAME"` (e.g. `"M VERSTAPPEN"`). A driver with a `broadcast_name` structured differently (e.g. full first name, or two-part surname like `"ZHOU GUANYU"`) would produce a silently wrong display name.
  **Fixed:** Added comment documenting the expected `"INITIAL SURNAME"` format, confirming multi-word surnames (e.g. "M DE VRIES") are handled correctly, and noting what a format deviation would look like. No 2026 roster drivers have deviating broadcast names.

- [x] Q3 🟢 — `preview.js`: path traversal in `/assets/` handler
  ~~`scripts/preview.js:241` — `path.join(ROOT, url.pathname)` doesn't block traversal (e.g. `/assets/../../../../etc/passwd`). Dev-only tool, not a production risk, but trivial to fix.~~
  **Fixed:** Switched to `path.resolve()` with a prefix check against the assets root. Fixed as part of the circuit image source work.

- [ ] Q4 🟢 — No `package.json`: no engine constraint or script aliases
  No file declares `"engines": { "node": ">=22" }` to guard against older Node (no native `fetch`). No `scripts` field.
  **Fix:** Add a minimal `package.json` with engine constraint and `preview` / pipeline script aliases.

---

## Template

- [x] T1 🟡 — Off-season view: `standings.constructors` is unsliced (all 11 teams render)
  `template.html:84`, `scripts/build-payload.js:169` — No length cap on constructors in the off-season payload. 11 rows at `padding: var(--gap-small) 0` + `text--large` in a 234px-wide column may overflow vertically.
  **Decision:** Non-issue for now — no changes. Added a comment in the template flagging the overflow risk for when the off-season view is formally designed.

- [x] T2 🟡 — Hardcoded `font-size` values on icons — use framework classes
  `template.html:123` (`font-size: 26px` trophy), `template.html:138` (`font-size: 21px` arrow), `template.html:157` + `203` (`font-size: 20px` weather icons).
  **Fixed:** Trophy → `text--xlarge` (exact), arrow → `text--large` (exact), weather icons → `text--large` (21px, 1px off from 20px). Inline `font-size` removed; `line-height: 1` retained.

- [x] T3 🟢 — Hardcoded `gap` values with no CSS variable equivalent
  `template.html:177` (`gap: 2px`), `template.html:256` (`gap: 48px`), `template.html:17` (`gap: 160px`). The latter two are design-specific values with no framework variable match.
  **Decision:** Leave as-is. None of the three map closely enough to a framework variable to swap without changing the layout.

- [x] T4 🟢 — `border-radius: 50%` on compound tire circles — `rounded--full` class exists
  `template.html:237` — Inline `border-radius: 50%` duplicates what `class="rounded--full"` provides.
  **Fixed:** Added `rounded--full` class; removed inline `border-radius: 50%`.

- [x] T5 🟢 — `{{ meeting.name }}` at `text--xxxlarge` may overflow on long names
  `template.html:104` — Names like "Formula 1 Lenovo Chinese Grand Prix 2026" at 52px across ~960px. Verify the longest `meeting_name` in the 2026 calendar fits.
  **Fixed:** Added `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` to the meeting name div.

- [ ] T6 🟢 — LIVE badge: verify `label` + `text--xlarge` renders correctly on device
  `template.html:194` — The `label` class has its own `font-size`. Applying `text--xlarge` (26px) inside it may behave differently on the TRMNL pixel font renderer vs the preview. Verify on hardware.
  **Note:** No code change suggested — this is a device-verification task only. If the badge looks wrong on hardware, remove `text--xlarge` and let the `label` class control its own size.

---

## Missing / Recommendations

- [x] M1 🔴 — Calendar / off-weekend view is not designed or built
  Currently `off_weekend` mode falls into the race-weekend template branch showing the next GP's sessions (all 'upcoming') with forecasts. When this view is designed, the `{% else %}` branch in `template.html` will need splitting into `off_weekend` vs `race_weekend` sub-branches.

- [x] M2 🟡 — Post-race view: needs fixture-driven validation for edge cases
  The winner block, "Up Next" section, and `next_race` payload are implemented end-to-end. What's missing is validation against edge cases: no qualifying results (grid position null), no portrait URL, very long driver names.
  **Decision:** Non-issue. `grid_position` and `portrait_url` are already guarded by `{% if %}` in the template. Long driver names are an acceptable visual QA item for when the post-race view is first tested on hardware.

- [x] M3 🟡 — Circuit static data (lap record, corners, DRS zones, length) not yet in `circuits.js`
  Noted in CLAUDE.md as planned. `circuits.js` is the natural home. No action needed until the template has a place to display it.

- [x] M4 🟢 — Preview auto-refresh
  `scripts/preview.js` re-reads `template.html` on every request but the browser doesn't reload automatically on file changes. A `<meta http-equiv="refresh" content="3">` or file-watch + SSE would speed up template iteration.
  **Decision:** Not needed — dev tool, manual reload is fine.
