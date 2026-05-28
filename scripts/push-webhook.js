#!/usr/bin/env node
// Reads build-payload.js JSON from stdin, POSTs it to the TRMNL webhook.
// Usage: node scripts/fetch-data.js | node scripts/build-payload.js | node scripts/push-webhook.js

// One retry with 2 s backoff, matching the pattern in fetch-data.js.
async function postWebhook(url, body, retries = 1) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}\n${text}`);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      process.stderr.write(`Webhook failed, retrying in 2s: ${err.message}\n`);
      await new Promise(resolve => setTimeout(resolve, 2_000));
      return postWebhook(url, body, retries - 1);
    }
    throw err;
  }
}

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
      const res = await postWebhook(webhookUrl, JSON.stringify({ merge_variables: payload }));
      process.stdout.write(`Webhook delivered (HTTP ${res.status})\n`);
    } catch (err) {
      process.stderr.write(`Fatal: ${err.message}\n`);
      process.exit(1);
    }
  });
}

main();
