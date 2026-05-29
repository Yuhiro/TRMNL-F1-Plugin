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

## Round 3 findings

- [x] B4 🟡 — `precip_probability` null from Open-Meteo renders as `"null%"` in weather display
  `build-payload.js:141,304` — `${f.precip_probability}%` has no null guard. Open-Meteo documents `precipitation_probability_max` as a best-estimate field that returns `null` beyond roughly the 7-day model horizon and for some climate zones. When null, the template renders the literal string `"null%"` on the device. (`temp_max` is safe: `Math.round(null) === 0`, so worst case is `"0°C"`.)
  **Fix:** `f.precip_probability != null ? \`${f.precip_probability}%\` : '—'` at both sites.

- [x] T6 🟢 — Hardcoded `gap: 2px` in completed session name/time block is below the CSS variable scale
  `template.html:186` — Won't fix. The 2px gap is intentional tighter spacing for de-emphasised completed session rows, below the minimum CSS variable scale.

- [x] Q4 🟢 — `preview.js` startup uses `console.log`, violating the project's stdout/stderr convention
  `preview.js:308–310,317` — Won't fix. `console.log` is preferred for the dev preview server; the stdout/stderr convention applies to pipeline scripts only.

- [x] M6 🟢 — Sprint compound rendering is untested; sprint-live fixture has inaccurate `compounds` for Sprint Qualifying
  `fixtures/miami-gp-sprint-live.json` and `build-payload.js:342` — `showCompounds` only triggers for `['Race', 'Sprint']`; Sprint Qualifying sessions produce `compounds: []`. But the sprint-live fixture has Sprint Qualifying as `last_session` with `compounds: ['S']` — data the pipeline would never produce. This gives a misleading template preview (tire circles appear for a Qualifying result). Additionally, there is no fixture with Sprint as `last_session`, so the Sprint compound rendering path is never exercised by `npm run validate`.
  **Fix:** (1) Clear `compounds: []` in the sprint-live fixture's Sprint Qualifying results. (2) Add a `miami-gp-after-sprint.json` fixture with Sprint as `last_session` and `compounds` populated.

---

---
<!-- completed -->

## Round 1 findings (completed)

- [x] T4 🟢 — `gap: 160px` and `gap: 48px` are outside the gap variable scale
  `template.html:17,261` — Won't fix. The 160px column gap on the off-season layout is intentional for display purposes and exceeds the framework scale. The 48px value no longer exists.


- [x] B1 🔴 — `post_race` winner block renders with no guard when results API failed
  `template.html:121` — When `view == 'post_race'` but `winner` is absent (race results API failed), Liquid silently renders the block with blank name, team, and trophy icon — a visible but empty winner section.
  **Fix:** Wrap the entire winner block in `{% if winner %}...{% endif %}`.

- [x] B2 🟡 — `next_race` "Up Next" block doesn't show round number
  `template.html:153` — `next_race.round` is in the payload but never rendered. The main meeting header shows `(Round {{ meeting.round }})`; the Up Next block doesn't. CLAUDE.md says round is always shown.
  **Fix:** Append `{% if next_race.round %} (Round {{ next_race.round }}){% endif %}` to the date_range line in the Up Next block.

- [x] M2 🟡 — Pre-season testing meetings inflate round numbers
  `fetch-data.js:69` — `assignRoundNumbers` counts all non-cancelled meetings. OpenF1 includes pre-season testing (confirmed: `meeting_official_name: "FORMULA 1 ARAMCO PRE-SEASON TESTING 2025"`, `is_cancelled: false`), so Australian GP becomes Round 2 instead of Round 1.
  **Fix:** Filter test meetings before assigning rounds: `meetings.filter(m => !m.is_cancelled && !/test/i.test(m.meeting_official_name ?? ''))`.

- [x] Q1 🟡 — `download-circuits.js` missing `AbortSignal.timeout()` on all fetches
  `download-circuits.js:33,39` — Both `fetchJSON` and `downloadImage` call `fetch()` with no timeout. A hung CDN connection blocks the script indefinitely. Violates the project convention.
  **Fix:** Add `signal: AbortSignal.timeout(30_000)` to both fetch calls.

- [x] I1 🟢 — Redundant sort on driver standings in `build-payload.js`
  `build-payload.js:251` — Closed in Round 1; reverted in Round 2 (B3). The sort is not redundant — see B3.

- [x] T3 🟢 — Hardcoded `#ccc` fallback in CSS variables doesn't match the actual colour
  `template.html:3,5` — `.standings-row` and `.timing-row` use `var(--light-grey, #ccc)`. The framework value is `#B0B7B6`; `#ccc` is lighter. Also used for vertical dividers at lines 181 and 194.
  **Fix:** Drop the fallback: `var(--light-grey)`.

## Round 2 findings (completed)

- [x] M3 🟡 — `validate-fixtures.js` has no coverage for `last_session`, `winner`, or `next_race`
  `validate-fixtures.js:23–24` — The validator checks top-level keys and meeting/standings sub-keys only. A field rename in `build-payload.js` for `last_session`, `winner`, or `next_race` passes validation and produces silent blank output on device. The `post_race` fixture has all three and none are validated.
  **Fix:** Added sub-key checks for `winner` (required for post_race), `last_session.results`, and `next_race.name/location/date_range/round`.


- [x] D1 🟢 — `push-webhook.js` outer `main().catch()` unreachable for async errors
  `push-webhook.js:39–42` — `main()` is `async` but has no `await` in its body — it sets up a listener and resolves immediately. The outer `.catch()` only covers synchronous throws from `main()`, all of which already call `process.exit(1)` inline. All real async errors (from `fetch` inside the listener) are caught by the inner `try/catch`. The outer catch is dead code.
  **Fix:** Removed the outer `main().catch(...)`; replaced with plain `main()`.


- [x] B3 🟡 — Race weekend driver standings not sorted before slice
  `build-payload.js:251` / `fetch-data.js:195` — After the Round 1 I1 fix removed the sort, the race weekend path relies on OpenF1 returning `/championship_drivers` in position order. The off-season path in `build-payload.js:175` explicitly sorts by `position_current`; race weekend does not. If the API returns unsorted data, the wrong top 6 are shown silently.
  **Fix:** Sort re-added before `.slice(0, 6)`. Round 1 I1 was a bad call — the sort is not redundant, it's defensive. See Q3.

- [x] Q2 🟡 — `push-webhook.js` uses `async` in event handler, inconsistent with project conventions
  `push-webhook.js:14` — `process.stdin.on('end', async () => {...})` is the `dev-conventions.md` `❌` pattern. The inner `try/catch` with `process.exit(1)` prevents silent failures, but the pattern is inconsistent with `build-payload.js` which uses the documented sync form.
  **Fix:** Won't fix. The rule guards against unhandled rejections from async event handlers — but the `try/catch` already closes that risk. Refactoring to match the pattern adds nesting with no safety gain.

- [x] Q3 🟢 — Undocumented assumption that OpenF1 `/championship_drivers` returns position-sorted data
  `fetch-data.js:195`, `build-payload.js:251` — `getStandings()` maps `rawDrivers` without sorting. The off-season `build-payload.js` path sorts explicitly; the race weekend path does not. The assumption was introduced implicitly when Round 1 removed the "redundant" sort. No comment documents the API contract.
  **Fix:** Resolved by B3 — sort added back defensively; both paths now sort consistently.

- [x] T5 🟢 — Weather dot separator size inconsistent between session list and "Up Next" block
  `template.html:162,209` — Session weather separators use `text--large text--muted` for the `·` dot. The `next_race` weather block uses `text--small text--muted` for the same element. Looks like a copy-paste error rather than a deliberate design choice.
  **Fix:** Changed "Up Next" dots to `text--large text--muted` to match session list.

- [x] M4 🟢 — No CI step runs `npm run validate`
  Won't fix — this project is local preview only, not CI/CD. `npm run validate` is a local dev tool, not a pipeline step.

- [x] M5 🟡 — No retry on TRMNL webhook POST
  `push-webhook.js:18–29` — `fetch-data.js` retries all API calls with 2 s backoff; `push-webhook.js` has none. A transient TRMNL error (502, timeout) on a 30-minute race weekend cadence means the display is potentially stale for 60 minutes across two consecutive failures.
  **Fix:** Extracted `postWebhook()` with one retry and 2 s backoff, matching `fetch-data.js:fetchJSON`.
