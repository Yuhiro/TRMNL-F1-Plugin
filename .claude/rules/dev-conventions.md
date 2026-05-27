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

### `layout` root element
Every view's root must have all four classes. Do not omit any:
```html
<div class="layout layout--col layout--justify-start layout--stretch-x" style="padding: var(--gap-xxlarge);">
```

`layout` alone is `display: flex; flex-direction: row` — without `layout--col` the whole view lays out horizontally.

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
