You are a senior software engineer doing a holistic code review of this TRMNL F1 plugin project. The project is a GitHub Actions data pipeline that fetches F1 data from OpenF1 and Open-Meteo, transforms it, and pushes it to a TRMNL e-ink display via webhook.

Start by reading every source file:

1. Read `scripts/fetch-data.js`
2. Read `scripts/build-payload.js`
3. Read `scripts/push-webhook.js`
4. Read `scripts/circuits.js` (if it exists)
5. Read `scripts/download-circuits.js`
6. Read `scripts/preview.js` (if it exists)
7. Read `.github/workflows/trmnl-update.yml`
8. Read `template.html`
9. Read `CLAUDE.md` for architecture context
10. Read `ISSUES.md` in full — understand every open and closed issue before writing a single new finding
11. Run `git log --oneline -10` for recent change history

Then review the full codebase across these dimensions and report your findings:

---

## Issue labelling

Label every issue with a short code based on its category and sequence number within that category:

| Prefix | Category |
|--------|----------|
| `B` | Bug |
| `I` | Inefficiency |
| `D` | Dead / Redundant Code |
| `Q` | Code Quality |
| `T` | Template |
| `M` | Missing / Recommendation |

Number new issues starting from the next available number per prefix (e.g. if B7 already exists, the first new bug is B8).

Use a checkbox to indicate resolution status:
- `[ ]` — open
- `[x]` — resolved

Format each issue as:

```
[ ] B1 🔴 — Short title
`file:line` — What breaks and under what conditions.
**Fix:** What to do.
```

---

## Before reporting any finding, check ISSUES.md

An issue that is already tracked — open or closed — must NOT be reported again unless one of these three conditions holds:

1. **It's a new distinct issue** — same general area but a different root cause, file, or line than the existing entry.
2. **A closed issue was wrong to close** — the fix wasn't actually applied, or the "won't fix" rationale no longer holds given recent changes.
3. **A prior decision has been invalidated** — e.g. a refactor reintroduced a problem that was previously resolved.

If none of those conditions hold, skip it entirely. Do not restate, re-number, or re-open it. Flip-flopping on closed issues wastes review cycles and erodes trust in the tracker.

---

## Bugs
List anything that will cause incorrect behaviour, silent failures, data loss, or crashes. Be specific — name the file, line/function, and what breaks and under what conditions.

## Inefficiencies
Flag anything that makes unnecessary API calls, does redundant work, performs blocking I/O where async is better, or wastes compute. Include pipeline ordering issues (e.g. fetching data that's discarded).

## Redundant or Dead Code
Identify code that is duplicated, unreachable, or superseded by something else in the codebase.

## Code Quality
Note anything that is hard to read, poorly named, missing obvious error handling at system boundaries (user input, external API calls), or violates the project's own conventions (see CLAUDE.md). Do not flag missing comments — comments are intentionally omitted here.

## Template (template.html)
Review the Liquid template and inline HTML/CSS against the TRMNL framework rules in CLAUDE.md. Flag incorrect flex patterns, hardcoded colours/sizes, missing CSS variable usage, layout issues.

## What's Missing / Recommendations
Based on the codebase and the "What's Not Built Yet" section in CLAUDE.md, suggest what should be added or improved next. Prioritise by impact.

---

After your findings, ask targeted questions about every area where you need more context to give better recommendations — things like intended edge cases, undocumented constraints, or trade-offs the developer may have already considered. Ask as many as are genuinely useful; don't pad and don't truncate.

Format your output with clear `##` section headers. Be direct and opinionated — say what should change and why, not just that something "could" be improved.

---

## Writing findings to ISSUES.md

After presenting your findings:

1. Only include issues that are **not already tracked** in `ISSUES.md` (applying the three-condition rule above). Do not duplicate existing open issues.

2. Append the new round's findings as a new `## Round N findings` section (where N is one more than the current highest round number in the file), above the `---` divider that separates open from completed issues.

3. Move any newly-resolved issues (closed during this session) to the completed section below the divider.

4. The file structure must follow this layout:

```
# Issues Tracker

[legend table]

---

## Round N findings
- [ ] ...open issues...

## Round N-1 findings (open only)
- [ ] ...remaining open issues from prior rounds...

---
<!-- completed -->

## Round N findings (completed)
- [x] ...

## Round N-1 findings (completed)
- [x] ...
```

5. Use the same bullet-point format as the existing entries:
   ```
   - [ ] CODE 🔴 — Short title
     `file:line` — Description.
     **Fix:** What to do.
   ```
