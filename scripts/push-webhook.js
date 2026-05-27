#!/usr/bin/env node
// Reads build-payload.js JSON from stdin, POSTs it to the TRMNL webhook.
// Usage: node scripts/fetch-data.js | node scripts/build-payload.js | node scripts/push-webhook.js

async function main() {
  const webhookUrl = process.env.TRMNL_WEBHOOK_URL;
  if (!webhookUrl) {
    process.stderr.write('Error: TRMNL_WEBHOOK_URL environment variable is not set\n');
    process.exit(1);
  }

  let raw = '';
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', async () => {
    try {
      const payload = JSON.parse(raw);

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_variables: payload }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const body = await res.text();
        process.stderr.write(`Webhook failed: HTTP ${res.status}\n${body}\n`);
        process.exit(1);
      }

      process.stdout.write(`Webhook delivered (HTTP ${res.status})\n`);
    } catch (err) {
      process.stderr.write(`Fatal: ${err.message}\n`);
      process.exit(1);
    }
  });
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
