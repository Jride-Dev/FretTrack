import process from 'node:process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const envPath = '.env.browserbase.local';
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

const apiKey = String(process.env.BROWSERBASE_API_KEY || '').trim();
const projectId = String(process.env.BROWSERBASE_PROJECT_ID || '').trim();
const targetUrl = String(process.env.BROWSERBASE_SMOKE_URL || 'https://app.frettrack-app.com').trim();

if (!apiKey || !projectId) {
  throw new Error('BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID are required in the environment or ignored .env.browserbase.local file.');
}

const target = new URL(targetUrl);
if (target.protocol !== 'https:' || !['app.frettrack-app.com', 'frettrack-app.com'].includes(target.hostname)) {
  throw new Error(`Browserbase smoke target is not an approved FretTrack production host: ${target.origin}`);
}

const sessionResponse = await fetch('https://api.browserbase.com/v1/sessions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-BB-API-Key': apiKey
  },
  body: JSON.stringify({
    projectId,
    timeout: 300,
    userMetadata: { suite: 'frettrack-read-only-smoke' }
  })
});

if (!sessionResponse.ok) {
  throw new Error(`Browserbase session creation failed (${sessionResponse.status}).`);
}

const session = await sessionResponse.json();
let browser;

try {
  browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  const response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  if (!response?.ok()) {
    throw new Error(`FretTrack returned HTTP ${response?.status() || 'unknown'} during Browserbase smoke.`);
  }

  await page.getByRole('heading', { name: /FretTrack/i }).first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible', timeout: 30_000 });

  console.log(`Browserbase read-only production smoke passed for ${target.origin}.`);
  console.log(`Session recording: https://browserbase.com/sessions/${session.id}`);
} finally {
  await browser?.close().catch(() => {});
  await fetch(`https://api.browserbase.com/v1/sessions/${session.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BB-API-Key': apiKey
    },
    body: JSON.stringify({ status: 'REQUEST_RELEASE', projectId })
  }).catch(() => {});
}
