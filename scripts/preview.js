#!/usr/bin/env node
/**
 * Local preview server for template.html with fixture data.
 *
 * Usage:
 *   node scripts/preview.js           # starts server + opens browser
 *   node scripts/preview.js --list    # list available fixtures
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const PORT = 3131;
const ROOT = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'template.html');
const FIXTURES_DIR = path.join(ROOT, 'fixtures');

// ─── Liquid renderer ─────────────────────────────────────────────────────────

function tokenize(template) {
  const tokens = [];
  let pos = 0;
  while (pos < template.length) {
    const outStart = template.indexOf('{{', pos);
    const tagStart = template.indexOf('{%', pos);
    let next = template.length;
    if (outStart !== -1) next = Math.min(next, outStart);
    if (tagStart !== -1) next = Math.min(next, tagStart);

    if (next > pos) {
      tokens.push({ type: 'text', value: template.slice(pos, next) });
      pos = next;
    }
    if (pos >= template.length) break;

    if (template[pos] === '{' && template[pos + 1] === '{') {
      const end = template.indexOf('}}', pos + 2);
      if (end === -1) { tokens.push({ type: 'text', value: template.slice(pos) }); break; }
      tokens.push({ type: 'output', value: template.slice(pos + 2, end).trim() });
      pos = end + 2;
    } else if (template[pos] === '{' && template[pos + 1] === '%') {
      const end = template.indexOf('%}', pos + 2);
      if (end === -1) { tokens.push({ type: 'text', value: template.slice(pos) }); break; }
      tokens.push({ type: 'tag', value: template.slice(pos + 2, end).trim() });
      pos = end + 2;
    } else {
      tokens.push({ type: 'text', value: template[pos] });
      pos++;
    }
  }
  return tokens;
}

function getVal(expr, ctx) {
  return expr.trim().split('.').reduce((obj, key) => (obj != null ? obj[key] : undefined), ctx);
}

function evalCondition(expr, ctx) {
  const numCmp = expr.match(/^(.+?)\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (numCmp) {
    const lhs = Number(getVal(numCmp[1].trim(), ctx));
    const rhs = Number(numCmp[3]);
    if (numCmp[2] === '>') return lhs > rhs;
    if (numCmp[2] === '<') return lhs < rhs;
    if (numCmp[2] === '>=') return lhs >= rhs;
    if (numCmp[2] === '<=') return lhs <= rhs;
  }
  const eq = expr.match(/^(.+?)\s*==\s*['"](.+?)['"]$/);
  if (eq) return String(getVal(eq[1].trim(), ctx)) === eq[2];
  const neq = expr.match(/^(.+?)\s*!=\s*['"](.+?)['"]$/);
  if (neq) return String(getVal(neq[1].trim(), ctx)) !== neq[2];
  return !!getVal(expr.trim(), ctx);
}

function renderTokens(tokens, ctx) {
  let out = '';
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === 'text') { out += t.value; i++; continue; }
    if (t.type === 'output') {
      const v = getVal(t.value, ctx);
      out += v != null ? v : '';
      i++; continue;
    }
    if (t.type === 'tag') {
      // Skip closing/branch tags encountered at top level (they're consumed by parent)
      if (t.value === 'endfor' || t.value === 'endif' || t.value === 'else' || t.value.startsWith('elsif')) {
        i++; continue;
      }

      if (t.value.startsWith('for ')) {
        const m = t.value.match(/^for (\w+) in (.+)$/);
        if (!m) { i++; continue; }
        const [, itemVar, arrayPath] = m;
        const arr = getVal(arrayPath, ctx) || [];
        let depth = 1, j = i + 1;
        const body = [];
        while (j < tokens.length) {
          const bt = tokens[j];
          if (bt.type === 'tag' && bt.value.startsWith('for ')) depth++;
          if (bt.type === 'tag' && bt.value === 'endfor') { if (--depth === 0) { j++; break; } }
          body.push(bt); j++;
        }
        for (const item of arr) out += renderTokens(body, { ...ctx, [itemVar]: item });
        i = j; continue;
      }

      if (t.value.startsWith('if ')) {
        const blocks = [{ condition: t.value.slice(3).trim(), tokens: [] }];
        let depth = 1, j = i + 1;
        while (j < tokens.length) {
          const bt = tokens[j];
          if (bt.type === 'tag' && bt.value.startsWith('if ')) depth++;
          if (bt.type === 'tag' && bt.value === 'endif') { if (--depth === 0) { j++; break; } }
          if (depth === 1 && bt.type === 'tag') {
            if (bt.value.startsWith('elsif ')) { blocks.push({ condition: bt.value.slice(6).trim(), tokens: [] }); j++; continue; }
            if (bt.value === 'else') { blocks.push({ condition: null, tokens: [] }); j++; continue; }
          }
          blocks[blocks.length - 1].tokens.push(bt); j++;
        }
        for (const block of blocks) {
          if (block.condition === null || evalCondition(block.condition, ctx)) {
            out += renderTokens(block.tokens, ctx); break;
          }
        }
        i = j; continue;
      }

      i++;
    }
  }
  return out;
}

function renderTemplate(template, data) {
  return renderTokens(tokenize(template), data);
}

// ─── TRMNL CSS stub ──────────────────────────────────────────────────────────

const TRMNL_CSS = `
  :root {
    --gap-xsmall: 5px; --gap-small: 7px; --gap: 10px;
    --gap-medium: 16px; --gap-large: 20px; --gap-xlarge: 30px; --gap-xxlarge: 40px;
    --light-grey: #B0B7B6; --mid-grey: #5D5F5E;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #b8bfbf; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1F201F; }

  .trmnl-screen {
    width: 1040px; height: 780px; background: #D3DCDC; overflow: hidden;
    position: relative; margin: 20px auto;
    border: 2px solid #555; box-shadow: 0 4px 24px rgba(0,0,0,0.25);
    display: flex; flex-direction: column;
  }

  .layout { display: flex; flex-direction: row; width: 100%; height: 100%; }
  .layout--col { flex-direction: column !important; }
  .layout--row { flex-direction: row !important; }
  .layout--justify-start { justify-content: flex-start; }
  .layout--justify-center { justify-content: center; }
  .layout--justify-end { justify-content: flex-end; }
  .layout--align-start { align-items: flex-start; }
  .layout--align-center { align-items: center; }
  .layout--align-end { align-items: flex-end; }
  .layout--stretch-x > * { width: 100%; }
  .layout--stretch-y > * { height: 100%; }

  .text--small  { font-size: 12px; line-height: 1.3; }
  .text--base   { font-size: 16px; line-height: 1.3; }
  .text--large  { font-size: 21px; line-height: 1.3; }
  .text--xlarge { font-size: 26px; line-height: 1.2; }
  .text--xxlarge  { font-size: 38px; line-height: 1.1; }
  .text--xxxlarge { font-size: 52px; line-height: 1.0; font-weight: bold; }
  .font--bold { font-weight: bold; }
  .text--muted { color: #5D5F5E; }

  .label { display: inline-flex; align-items: center; padding: 2px 8px; border: 1px solid currentColor; font-size: 16px; line-height: 1.3; }
  .label--small  { font-size: 12px; padding: 1px 5px; }
  .label--filled { background: #1F201F; color: #D3DCDC; border-color: #1F201F; }
  .label--outline { border: 1px solid currentColor; }
  .label--underline { text-decoration: underline; border: none; }

  .rounded--full  { border-radius: 9999px; }
  .rounded--small { border-radius: 7px; }
  .rounded        { border-radius: 10px; }
  .rounded--large { border-radius: 20px; }
`;

// ─── HTML wrapper ─────────────────────────────────────────────────────────────

function wrapPage(renderedContent, fixtureName, fixtures) {
  const links = fixtures.map(f => {
    const active = f === fixtureName;
    const style = active
      ? 'font-weight:600;color:#000;text-decoration:none;'
      : 'color:#555;text-decoration:none;';
    return `<a href="/?fixture=${encodeURIComponent(f)}" style="${style}">${f.replace(/-/g, ' ')}</a>`;
  }).join('<span style="margin:0 8px;color:#bbb;">·</span>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TRMNL Preview — ${fixtureName}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.44.0/dist/tabler-icons.min.css">
  <style>${TRMNL_CSS}</style>
  <style>
    .toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #fff; border-bottom: 1px solid #ddd;
      padding: 9px 16px; font-family: monospace; font-size: 12px;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .toolbar-label { color: #aaa; margin-right: 4px; }
    body { padding-top: 44px; min-width: 1080px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-label">fixture</span>
    ${links}
  </div>
  <div class="trmnl-screen">
    ${renderedContent}
  </div>
</body>
</html>`;
}

// ─── Server ───────────────────────────────────────────────────────────────────

function listFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort();
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Serve local circuit images (openf1/ and official/ subfolders)
    if (url.pathname.startsWith('/assets/')) {
      const assetsRoot = path.resolve(ROOT, 'assets');
      const filePath = path.resolve(ROOT, url.pathname.slice(1));
      if (!filePath.startsWith(assetsRoot)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      res.writeHead(404); res.end('Not found'); return;
    }

    const fixtures = listFixtures();
    if (fixtures.length === 0) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('No fixtures found. Create JSON files in fixtures/ directory.');
      return;
    }

    const fixtureName = url.searchParams.get('fixture') || fixtures[0];
    const fixturePath = path.join(FIXTURES_DIR, `${fixtureName}.json`);

    if (!fs.existsSync(fixturePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Fixture not found: ${fixtureName}`);
      return;
    }

    try {
      const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
      const data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      // Rewrite GitHub raw image URLs to local paths so images load without a network request.
      // Handles both assets/circuits/openf1/ and assets/circuits/official/ subfolders.
      if (data.meeting?.circuit_image_url) {
        const match = data.meeting.circuit_image_url.match(/assets\/circuits\/.+$/);
        if (match) data.meeting.circuit_image_url = `/${match[0]}`;
      }
      if (data.logo_url) {
        const match = data.logo_url.match(/assets\/f1-logo\..+$/);
        if (match) data.logo_url = `/${match[0]}`;
      }

      const rendered = renderTemplate(template, data);
      const page = wrapPage(rendered, fixtureName, fixtures);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Render error: ${err.message}\n\n${err.stack}`);
    }
  });

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Preview running at ${url}`);
    console.log('Fixtures:');
    listFixtures().forEach(f => console.log(`  ${f}`));
    const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${open} ${url}`);
  });
}

if (process.argv.includes('--list')) {
  listFixtures().forEach(f => console.log(f));
} else {
  serve();
}
