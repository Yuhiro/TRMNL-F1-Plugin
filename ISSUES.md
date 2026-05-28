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

## Round 1 findings (open only)

- [ ] T4 🟢 — `gap: 160px` and `gap: 48px` are outside the gap variable scale
  `template.html:17,261` — Off-season two-column layout uses `gap: 160px`; standings columns use `gap: 48px`. Neither maps to a gap CSS variable (scale tops at `var(--gap-xxlarge)` = 40px).
  **Fix:** Check Figma node spacing before changing — these may be intentional design values.

---

## Round 2 findings

- [x] B3 🟡 — Race weekend driver standings not sorted before slice
  `build-payload.js:251` / `fetch-data.js:195` — After the Round 1 I1 fix removed the sort, the race weekend path relies on OpenF1 returning `/championship_drivers` in position order. The off-season path in `build-payload.js:175` explicitly sorts by `position_current`; race weekend does not. If the API returns unsorted data, the wrong top 6 are shown silently.
  **Fix:** Sort re-added before `.slice(0, 6)`. Round 1 I1 was a bad call — the sort is not redundant, it's defensive. See Q3.

- [ ] D1 🟢 — `push-webhook.js` outer `main().catch()` unreachable for async errors
  `push-webhook.js:39–42` — `main()` is `async` but has no `await` in its body — it sets up a listener and resolves immediately. The outer `.catch()` only covers synchronous throws from `main()`, all of which already call `process.exit(1)` inline. All real async errors (from `fetch` inside the listener) are caught by the inner `try/catch`. The outer catch is dead code.
  **Fix:** Remove the outer `main().catch(...)`.

- [ ] Q2 🟡 — `push-webhook.js` uses `async` in event handler, inconsistent with project conventions
  `push-webhook.js:14` — `process.stdin.on('end', async () => {...})` is the `dev-conventions.md` `❌` pattern. The inner `try/catch` with `process.exit(1)` prevents silent failures, but the pattern is inconsistent with `build-payload.js` which uses the documented sync form.
  **Fix:** Restructure to avoid `async` in the event handler — e.g., kick off an async IIFE inside the sync handler and attach `.catch(err => { process.stderr.write(...); process.exit(1); })`.

- [x] Q3 🟢 — Undocumented assumption that OpenF1 `/championship_drivers` returns position-sorted data
  `fetch-data.js:195`, `build-payload.js:251` — `getStandings()` maps `rawDrivers` without sorting. The off-season `build-payload.js` path sorts explicitly; the race weekend path does not. The assumption was introduced implicitly when Round 1 removed the "redundant" sort. No comment documents the API contract.
  **Fix:** Resolved by B3 — sort added back defensively; both paths now sort consistently.

- [x] T5 🟢 — Weather dot separator size inconsistent between session list and "Up Next" block
  `template.html:162,209` — Session weather separators use `text--large text--muted` for the `·` dot. The `next_race` weather block uses `text--small text--muted` for the same element. Looks like a copy-paste error rather than a deliberate design choice.
  **Fix:** Changed "Up Next" dots to `text--large text--muted` to match session list.

- [ ] M3 🟡 — `validate-fixtures.js` has no coverage for `last_session`, `winner`, or `next_race`
  `validate-fixtures.js:23–24` — The validator checks top-level keys and meeting/standings sub-keys only. A field rename in `build-payload.js` for `last_session`, `winner`, or `next_race` passes validation and produces silent blank output on device. The `post_race` fixture has all three and none are validated.
  **Fix:** Add required sub-key checks for `last_session.results`, `winner.name/team`, and `next_race.name/location` when those keys are present. Optionally assert that `post_race` fixtures include `winner`.

- [x] M4 🟢 — No CI step runs `npm run validate`
  Won't fix — this project is local preview only, not CI/CD. `npm run validate` is a local dev tool, not a pipeline step.

- [x] M5 🟡 — No retry on TRMNL webhook POST
  `push-webhook.js:18–29` — `fetch-data.js` retries all API calls with 2 s backoff; `push-webhook.js` has none. A transient TRMNL error (502, timeout) on a 30-minute race weekend cadence means the display is potentially stale for 60 minutes across two consecutive failures.
  **Fix:** Extracted `postWebhook()` with one retry and 2 s backoff, matching `fetch-data.js:fetchJSON`.
