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

## Round 1 findings

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
  `build-payload.js:251` — `standings.drivers.sort(...)` re-sorts by `position_current` every pipeline run, but the array is already in position order from `fetch-data.js`. Harmless but redundant.
  **Fix:** Remove the `.sort()` call; rely on the order already established in `getStandings()`.

- [x] T3 🟢 — Hardcoded `#ccc` fallback in CSS variables doesn't match the actual colour
  `template.html:3,5` — `.standings-row` and `.timing-row` use `var(--light-grey, #ccc)`. The framework value is `#B0B7B6`; `#ccc` is lighter. Also used for vertical dividers at lines 181 and 194.
  **Fix:** Drop the fallback: `var(--light-grey)`.

- [ ] T4 🟢 — `gap: 160px` and `gap: 48px` are outside the gap variable scale
  `template.html:17,261` — Off-season two-column layout uses `gap: 160px`; standings columns use `gap: 48px`. Neither maps to a gap CSS variable (scale tops at `var(--gap-xxlarge)` = 40px).
  **Fix:** Check Figma node spacing before changing — these may be intentional design values.

