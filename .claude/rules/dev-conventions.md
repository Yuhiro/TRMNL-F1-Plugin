# Dev Conventions

Rules derived from real bugs and code-review findings in this project.
Violations of these conventions are what ISSUES.md has been tracking.

---

## Node.js Scripts

### Module system: CJS only
Always use `require()` and `module.exports`. Never use `import`, `export`, or `import.meta`.
No `package.json` declares `"type": "module"` — ESM syntax throws `SyntaxError` before a single line runs.

```js
// ✅
const CIRCUITS = require('./circuits');

// ❌
import CIRCUITS from './circuits.js';
```

### Error handling in stdin `'end'` handlers
Errors thrown inside async event handlers are not caught by the outer promise chain.
Always wrap the entire `'end'` body in `try/catch` and `process.exit(1)` on failure.

```js
// ✅
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(raw);
    // ...
  } catch (err) {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
  }
});

// ❌ — parse errors silently swallowed or logged only as warnings
process.stdin.on('end', async () => {
  const data = JSON.parse(raw); // unguarded
});
```

### Output: stderr vs stdout
- `process.stdout.write(...)` — pipeline data only (JSON payloads, delivery confirmations)
- `process.stderr.write(...)` — all errors, warnings, and diagnostics
- Never use `console.log` or `console.error` — they both go to the same fd and pollute the pipeline

### Fetch: always set a timeout
```js
// ✅
const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

// ❌
const res = await fetch(url);
```

### Parallel fetches
Use `Promise.all()` for independent fetches. Sequential `await` for each is an inefficiency.
Non-critical fetches that shouldn't fail the pipeline go inside `.catch()` within the `Promise.all` array, not outside it.

### Data fallbacks
Every data access from an API response that could be absent needs a fallback:
```js
// ✅
acronym: DRIVER_MAP[d.driver_number]?.acronym ?? `#${d.driver_number}`,

// ❌
acronym: DRIVER_MAP[d.driver_number].acronym,
```

### Pipeline script scope: `build-payload.js` only sees its stdin JSON
Each script is a separate process. `build-payload.js` cannot access `DRIVER_MAP`, `getStandings()`, or anything else from `fetch-data.js`. Any data it needs must either:
- Come through the JSON payload (i.e. `fetch-data.js` must include it in `output`), or
- Be defined in `build-payload.js` itself (e.g. `TEAM_NAMES`, `require('./circuits')`)

Bugs this prevents:
- `DRIVER_MAP` referenced in `build-payload.js` but never defined there → `ReferenceError`
- Winner team looked up via `DRIVER_MAP[p1.driver_number]?.team` in `build-payload.js` → crashed silently

### `view` is computed in `fetch-data.js`, not `build-payload.js`
`determineView()` lives in `fetch-data.js`. `output.view` is set there and travels through the JSON.
`build-payload.js` reads `data.view` — it does not recompute it.

```js
// fetch-data.js ✅
output.view = determineView(output.sessions);
process.stdout.write(JSON.stringify(output, null, 2) + '\n');

// build-payload.js ✅
const view = data.view;
```

### Data belongs in one place — never duplicate across files
- Circuit metadata (coords, image filenames, names, types) → `circuits.js` only. Both `fetch-data.js` and `build-payload.js` `require('./circuits')`.
- Driver display names → derived from OpenF1 `broadcast_name` via `formatBroadcastName()` in `fetch-data.js`. Never maintain a static `DRIVER_DISPLAY` map in `build-payload.js`.

The bug pattern: a duplicate lookup table in a second file that diverges — e.g. `CIRCUIT_INFO` in `build-payload.js` missing the `'Madring'` key that `circuits.js` had.

### When mapping objects for the payload, pass through all fields the template uses
`build-payload.js` maps `fetch-data.js` data into the webhook payload. If a field is used in `template.html`, it must be explicitly included in the map — JavaScript object spread with `...r` is not sufficient because the downstream Liquid template only sees what the payload contains.

Cross-check `build-payload.js` mapping against `template.html` uses before finalising. Example failure: `dnf`, `dns`, `dsq` were present in `fetch-data.js` session results but not passed through the `build-payload.js` map → blank time cells for retired drivers.

### Filter `is_cancelled` meetings on every iteration
Any loop or search over meetings must skip cancelled ones:

```js
// ✅
meetings.filter(m => !m.is_cancelled && ...)

// ❌ — cancelled meetings have past dates and will appear as "completed" races
meetings.filter(m => new Date(m.date_start) > n)
```

### Race/Sprint sessions overrun — use `OVERRUN_BUFFER_MS`
Race and Sprint sessions routinely finish 5–20 minutes after `date_end`. Without a buffer, `classifySessions` marks the session as `completed` while it's still running, causing the LIVE badge to drop and result fetches to fire before the API has data.

`OVERRUN_BUFFER_MS = 30 * 60 * 1000` must be applied to `effectiveEnd` in `classifySessions`:

```js
const effectiveEnd = ['Race', 'Sprint'].includes(s.session_name)
  ? new Date(end.getTime() + OVERRUN_BUFFER_MS)
  : end;
```

### Gate post_race-specific fetches on `view === 'post_race'`
`nextMeet` sessions and the next-race forecast are only needed for the post_race view. Compute `view` early (right after the `Promise.all` standings/weather block) so the gate can be applied:

```js
view = determineView(output.sessions);
const nextMeet = view === 'post_race' ? ... : null;
```

Fetching `nextMeet` unconditionally is wasted work on every non-post_race run.

### Compound tire letter: use `stint.compound?.[0]`, not a static lookup table
```js
// ✅ — works for any compound the API returns
const letter = stint.compound?.[0] ?? '?';

// ❌ — breaks silently for any compound not in the table
const compoundLetter = { SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W' };
const letter = compoundLetter[stint.compound] ?? '?';
```

### Constructor team names from the API are full strings, not short codes
`/drivers?session_key=latest` returns `team_name: "McLaren"` (the full display name), not `"MCL"`.
The `team` field on driver standings entries must be normalised to the short code using the `fullNameToCode` reverse lookup (built from `liveTeamMap` + `DRIVER_MAP`) before the constructor standings aggregation runs.

Without this, `teamPoints['McLaren'] = 106` accumulates separately from `teamPoints['MCL'] = 0` and standings are wrong.

### circuits.js: keys must match OpenF1 `circuit_short_name` exactly
The key is what OpenF1 returns in `circuit_short_name` — not a common name or city name.
Known non-obvious values:
- `'Madring'` — Circuit de Barcelona-Catalunya (NOT `'Barcelona'`, NOT `'Madrid'`)
- `'Las Vegas'` — note the space
- `'Yas Marina Circuit'` — includes "Circuit"

When adding a new circuit, verify the exact `circuit_short_name` from the OpenF1 `/meetings` response before adding the key.

### JSON output format
```js
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
```
Always 2-space indent, always trailing newline.

### Document non-obvious contracts in comments
If code depends on a specific format, URL structure, or API behaviour, explain it inline.

```js
// ✅ — explains the expected format and what breaks if it changes
// OpenF1 format: "INITIAL SURNAME" — always a single uppercase letter followed by
// the surname in all-caps (e.g. "M VERSTAPPEN", "C LECLERC").

// ❌ — silent dependency
const initial = parts[0];
const surname = parts.slice(1)...
```

---

## Liquid Template (`template.html`)

### Never hardcode CSS values that have framework equivalents

**Gaps — use CSS variables, not px:**
```html
<!-- ✅ -->
<div style="gap: var(--gap-medium);">

<!-- ❌ -->
<div style="gap: 16px;">
```

Gap variable reference:
- `var(--gap-xsmall)` — 5px
- `var(--gap-small)` — 7px
- `var(--gap)` — 10px
- `var(--gap-medium)` — 16px
- `var(--gap-large)` — 20px
- `var(--gap-xlarge)` — 30px
- `var(--gap-xxlarge)` — 40px

**Colours — use CSS variables or classes, not hex:**
```html
<!-- ✅ -->
background-color: var(--light-grey);
class="text--muted"

<!-- ❌ -->
background-color: #CCC;
color: #888888;
```

**Borders:**
```html
<!-- ✅ -->
border-bottom: 1px solid var(--light-grey, #ccc);

<!-- ❌ -->
border-bottom: 1px solid #CCCCCC;
```

### Icons: never set font-size inline — use text size classes
```html
<!-- ✅ -->
<i class="ti ti-sun text--large" style="line-height: 1;"></i>

<!-- ❌ -->
<i class="ti ti-sun" style="font-size: 20px; line-height: 1;"></i>
```

Always keep `line-height: 1` on icons — without it, icons add unexpected vertical space.

### Rounded corners: use framework classes
```html
<!-- ✅ -->
<div class="rounded--full" ...>

<!-- ❌ -->
<div style="border-radius: 50%;" ...>
```

Rounded classes: `rounded--full` (pill), `rounded--small` (7px), `rounded` (10px), `rounded--large` (20px).

### Layout: avoid `flex--row` / `flex--col` for structural containers
These utility classes add `justify-content: center` and `align-items: center`, which causes unwanted centering on structural containers.

```html
<!-- ✅ — structural container -->
<div style="display: flex; flex-direction: row; gap: var(--gap-medium);">

<!-- ❌ — structural container, but centering is applied -->
<div class="flex--row" style="gap: var(--gap-medium);">
```

Reserve `flex--row` / `flex--col` for leaf-level alignment where centering is intentional.

### `layout` root element: all four classes are required
Every view's root must have all four classes. Do not omit any:
```html
<div class="layout layout--col layout--justify-start layout--stretch-x" style="padding: var(--gap-xxlarge);">
```

- Without `layout--col`: content lays out horizontally (`.layout` is `flex-direction: row` by default)
- Without `layout--justify-start`: content is centred vertically, not stacked from the top
- Without `layout--stretch-x`: children don't fill the full width

### Pin the Tabler Icons CDN version — never use `@latest`
```html
<!-- ✅ -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.44.0/dist/tabler-icons.min.css">

<!-- ❌ — breaks silently when the library updates -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
```

### Don't duplicate template blocks for nearly-identical states — use inline conditionals
If two states (e.g. `live` and `upcoming`) share 90% of their markup, use one block with a conditional inside rather than two separate blocks. Duplicate blocks drift apart over time and create bugs where a fix applied to one is forgotten in the other.

```liquid
<!-- ✅ — one block, inline LIVE badge conditional -->
{% else %}
<div ...>
  <div style="display: flex; flex-direction: row; ...">
    <span class="text--xlarge">{{ session.name }}</span>
    {% if session.status == 'live' %}
    <span class="label label--filled text--xlarge rounded--small" ...>LIVE</span>
    {% endif %}
  </div>
  ...
</div>

<!-- ❌ — two nearly-identical blocks that will drift -->
{% if session.status == 'live' %}
<div ...> ... LIVE badge ... </div>
{% elsif session.status == 'upcoming' %}
<div ...> ... same markup without badge ... </div>
{% endif %}
```

### Guard optional data with `{% if %}`
Any payload field that may be absent (portrait URLs, weather, grid position) must be guarded:
```liquid
{% if winner.portrait_url %}
<img src="{{ winner.portrait_url }}" ...>
{% else %}
<div style="width: 93px; height: 93px; flex-shrink: 0;"></div>
{% endif %}
```

### `elsif` not `else if` in Liquid
```liquid
<!-- ✅ -->
{% elsif result.dns %}

<!-- ❌ -->
{% else if result.dns %}
```

---

## What Not to Change Without Checking

- **`circuits.js` keys** — must match OpenF1 `circuit_short_name` exactly; check before renaming
- **`DRIVER_MAP` driver numbers** — source of truth for acronym + team short code; verify against OpenF1 before updating
- **`TEAM_NAMES` short codes** — must match the `team` field that `DRIVER_MAP` produces
- **`output.view` values** — `pre_weekend`, `race_weekend`, `live`, `post_race`, `off_season`; template branches on these exactly
- **Session name strings** — `'Practice 1'`, `'Practice 2'`, `'Practice 3'`, `'Sprint Qualifying'`, `'Sprint'`, `'Qualifying'`, `'Race'`; these come from OpenF1 and are matched with `===` in `determineView` and `classifySessions`
