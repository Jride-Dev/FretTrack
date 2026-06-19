import assert from 'node:assert/strict';
import worker from '../cloudflare/frettrack-coming-soon/src/index.js';

const BASE_URL = 'https://frettrack-app.com/api/beta-application';
const VALID_BODY = {
  name: 'Test Applicant',
  state: 'OH',
  shopName: 'Regression Repair',
  teamSize: '2',
  currentTracking: 'Paper and spreadsheets',
  email: 'landing-worker-test@example.com'
};

const originalFetch = globalThis.fetch;

try {
  await testLandingPageIncludesLaunchAssets();
  await testBundledFaviconAssetRoute();
  await testSuccessfulApplication();
  await testSupabaseFailureBlocksSuccess();
  await testEmailFailureDoesNotLoseSavedApplication();
  await testArchiveFailureDoesNotLoseSavedApplication();
  await testValidationFailureDoesNotCallSupabase();
  await testInvalidJson();
  console.log('Landing Worker beta application checks passed.');
} finally {
  globalThis.fetch = originalFetch;
}

async function testLandingPageIncludesLaunchAssets() {
  const response = await worker.fetch(new Request('https://frettrack-app.com/'), baseEnv());
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png">/);
  assert.match(html, /Request Beta Access/);
  assert.match(html, /\/landing\/overview\.jpg/);
  assert.match(html, /Stripe-powered account management planned/);
  assert.match(html, /https:\/\/devglobe\.app\/projects\/frettrack\?utm_source=badge&utm_medium=embed/);
  assert.match(html, /Launched on DevGlobe/);
}

async function testBundledFaviconAssetRoute() {
  const assetCalls = [];
  const response = await worker.fetch(new Request('https://frettrack-app.com/favicon.ico'), {
    ...baseEnv(),
    LANDING_ASSETS: {
      async fetch(request) {
        assetCalls.push(String(request.url));
        return new Response('icon-bytes', {
          headers: {
            'content-type': 'image/x-icon'
          }
        });
      }
    }
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'icon-bytes');
  assert.equal(assetCalls.length, 1);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
}

async function testSuccessfulApplication() {
  const calls = [];
  const r2Writes = [];
  globalThis.fetch = mockFetch(calls);

  const response = await postApplication(VALID_BODY, {
    FRETTRACK_APP_ASSETS: mockR2(r2Writes)
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.email, VALID_BODY.email);
  assert.equal(body.status, 'pending');
  assert.ok(body.requestedAt);
  assert.deepEqual(body.emailDelivery, { applicant: 'sent', operator: 'sent' });
  assert.equal(calls.filter((call) => call.kind === 'supabase').length, 1);
  assert.equal(calls.filter((call) => call.kind === 'resend').length, 2);
  assertApplicantConfirmationEmail(calls);
  assert.equal(r2Writes.length, 1);
}

async function testSupabaseFailureBlocksSuccess() {
  const calls = [];
  globalThis.fetch = mockFetch(calls, {
    supabaseResponse: Response.json({ message: 'RPC failed.' }, { status: 500 })
  });

  const response = await postApplication(VALID_BODY);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.ok, false);
  assert.match(body.error, /RPC failed/);
  assert.equal(calls.filter((call) => call.kind === 'supabase').length, 1);
  assert.equal(calls.filter((call) => call.kind === 'resend').length, 0);
}

async function testEmailFailureDoesNotLoseSavedApplication() {
  const calls = [];
  globalThis.fetch = mockFetch(calls, {
    resendResponse: Response.json({ message: 'Resend failed.' }, { status: 500 })
  });

  const response = await postApplication(VALID_BODY);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'pending');
  assert.equal(body.emailDelivery.applicant, 'failed');
  assert.equal(body.emailDelivery.operator, 'failed');
  assert.match(body.warning, /email failed|email delivery/i);
  assert.equal(calls.filter((call) => call.kind === 'supabase').length, 1);
}

async function testArchiveFailureDoesNotLoseSavedApplication() {
  const calls = [];
  globalThis.fetch = mockFetch(calls);

  const response = await postApplication(VALID_BODY, {
    FRETTRACK_APP_ASSETS: {
      async put() {
        throw new Error('R2 failed.');
      }
    }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'pending');
  assert.match(body.warning, /archive/i);
  assert.equal(calls.filter((call) => call.kind === 'supabase').length, 1);
}

async function testValidationFailureDoesNotCallSupabase() {
  const calls = [];
  globalThis.fetch = mockFetch(calls);
  const response = await postApplication({ ...VALID_BODY, email: 'bad-email' });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.match(body.error, /valid email/i);
  assert.equal(calls.length, 0);
}

async function testInvalidJson() {
  const calls = [];
  globalThis.fetch = mockFetch(calls);
  const request = new Request(BASE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{'
  });

  const response = await worker.fetch(request, baseEnv());
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(calls.length, 0);
}

async function postApplication(body, envOverrides = {}) {
  const request = new Request(BASE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'landing-worker-regression'
    },
    body: JSON.stringify(body)
  });

  return worker.fetch(request, {
    ...baseEnv(),
    ...envOverrides
  });
}

function baseEnv() {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    RESEND_API_KEY: 'resend-key',
    SHOP_EMAIL_FROM: 'FretTrack <noreply@frettrack-app.com>',
    BETA_APPLICATION_NOTIFY_TO: 'operator@example.com'
  };
}

function mockFetch(calls, options = {}) {
  return async (url, init = {}) => {
    const href = String(url);
    if (href.includes('/rest/v1/rpc/submit_beta_access_request')) {
      calls.push({ kind: 'supabase', url: href, init });
      return options.supabaseResponse || Response.json({
        ok: true,
        status: 'pending',
        email: VALID_BODY.email,
        requestedAt: '2026-06-12T00:00:00.000Z'
      });
    }

    if (href === 'https://api.resend.com/emails') {
      const body = JSON.parse(String(init.body || '{}'));
      calls.push({ kind: 'resend', url: href, init, body });
      return options.resendResponse || Response.json({ id: crypto.randomUUID() });
    }

    throw new Error(`Unexpected fetch: ${href}`);
  };
}

function mockR2(writes) {
  return {
    async put(key, value, options) {
      writes.push({ key, value, options });
    }
  };
}

function assertApplicantConfirmationEmail(calls) {
  const applicantCall = calls.find((call) => (
    call.kind === 'resend'
    && call.body.to === VALID_BODY.email
  ));

  assert.ok(applicantCall, 'Expected applicant confirmation email call.');
  assert.equal(applicantCall.body.subject, 'Thank you for signing up for the FretTrack Beta');
  assert.match(applicantCall.body.text, /Thank you for signing up for the FretTrack Beta!/);
  assert.match(applicantCall.body.text, /waiting for operator review/i);
  assert.match(applicantCall.body.text, /You do not need to submit another application/i);
  assert.match(applicantCall.body.text, /spam or junk folder/i);
  assert.match(applicantCall.body.html, /Thank you for signing up for the FretTrack Beta!/);
  assert.match(applicantCall.body.html, /FretTrack beta login/);
  assert.match(applicantCall.body.html, /spam or junk folder/i);
}
