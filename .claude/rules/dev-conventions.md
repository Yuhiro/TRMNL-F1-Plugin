# Dev Conventions

Generic coding patterns for this project's stack: Node.js stdin/stdout pipeline + Liquid template.

---

## Node.js

### Error handling in stdin `'end'` handlers
Errors thrown inside event handlers are not caught by the outer promise chain.
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

// ❌ — errors silently swallowed or only warned
process.stdin.on('end', async () => {
  const data = JSON.parse(raw);
});
```

### stderr vs stdout
- `process.stdout.write(...)` — pipeline data only
- `process.stderr.write(...)` — all errors, warnings, diagnostics
- Never `console.log` / `console.error` — pollutes the pipeline

### Always set a fetch timeout
```js
// ✅
const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

// ❌
const res = await fetch(url);
```

### Parallel fetches
Use `Promise.all()` for independent requests. Non-critical fetches that shouldn't abort the pipeline attach `.catch()` inside the array:

```js
const [critical, optional] = await Promise.all([
  fetchCritical(),
  fetchOptional().catch(err => { process.stderr.write(`...\n`); return null; }),
]);
```

### Data fallbacks
Every API field that could be absent needs a fallback — never assume presence:

```js
// ✅
name: data.name ?? 'Unknown',

// ❌
name: data.name,
```

### Document non-obvious API contracts in comments
If code depends on a specific response format or URL structure, explain it inline:

```js
// ✅
// OpenF1 broadcast_name format: "INITIAL SURNAME" (e.g. "M VERSTAPPEN").
// First token is the initial; remaining tokens form the surname.

// ❌
const initial = parts[0];
```

---

## Liquid Template

### Pin CDN dependencies to an exact version — never `@latest`
`@latest` resolves at request time and breaks silently when the library updates.
Check the current pinned version in `template.html` before changing it.

```html
<!-- ✅ -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/some-lib@2.1.0/dist/lib.min.css">

<!-- ❌ -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/some-lib@latest/dist/lib.min.css">
```

### Don't duplicate blocks for nearly-identical states — use inline conditionals
Duplicate blocks drift apart. A fix applied to one is silently missed in the other.

```liquid
{% comment %} ✅ — one block, small difference handled inline {% endcomment %}
{% for session in sessions %}
  {% if session.status == 'completed' %}
    ...muted block...
  {% else %}
    ...active block...
    {% if session.status == 'live' %}<span class="label">LIVE</span>{% endif %}
  {% endif %}
{% endfor %}
```

### Guard every optional field with `{% if %}`
Any payload field that may be absent must be guarded — missing fields render as empty strings, not errors, so bugs are silent:

```liquid
{% if driver.portrait_url %}
  <img src="{{ driver.portrait_url }}" ...>
{% else %}
  <div style="width: 25px; height: 25px;"></div>
{% endif %}
```

### `elsif`, not `else if`
```liquid
{% comment %} ✅ {% endcomment %}
{% elsif result.dns %}

{% comment %} ❌ — silently ignored by Liquid {% endcomment %}
{% else if result.dns %}
```
