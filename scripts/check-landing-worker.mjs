import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
const PUBLIC_DOC_ROUTES = [
  { route: '/docs/getting-started', assetPath: '/docs/getting-started.html', title: 'Start using FretTrack' },
  { route: '/docs/beta-tester-guide', assetPath: '/docs/beta-tester-guide.html', title: 'How to test FretTrack' },
  { route: '/docs/shops-and-accounts', assetPath: '/docs/shops-and-accounts.html', title: 'Manage shop access' },
  { route: '/docs/customers', assetPath: '/docs/customers.html', title: 'Manage customer records' },
  { route: '/docs/jobs', assetPath: '/docs/jobs.html', title: 'Create and manage jobs' },
  { route: '/docs/estimates', assetPath: '/docs/estimates.html', title: 'Document repair estimates' },
  { route: '/docs/photos-and-damage-maps', assetPath: '/docs/photos-and-damage-maps.html', title: 'Document condition clearly' },
  { route: '/docs/inventory-and-parts', assetPath: '/docs/inventory-and-parts.html', title: 'Track parts and purchasing' },
  { route: '/docs/shipping-and-custody', assetPath: '/docs/shipping-and-custody.html', title: 'Track movement through the shop' },
  { route: '/docs/scheduling', assetPath: '/docs/scheduling.html', title: 'Plan shop time' },
  { route: '/docs/reports', assetPath: '/docs/reports.html', title: 'Review shop performance' },
  { route: '/docs/billing-and-subscriptions', assetPath: '/docs/billing-and-subscriptions.html', title: 'Understand plan access' },
  { route: '/docs/roles-and-permissions', assetPath: '/docs/roles-and-permissions.html', title: 'Give people the right access' },
  { route: '/docs/troubleshooting', assetPath: '/docs/troubleshooting.html', title: 'Fix common problems' },
  { route: '/docs/faq', assetPath: '/docs/faq.html', title: 'Frequently asked questions' }
];
const PUBLIC_DOC_DENY_PATTERNS = [
  /\bPhase\s+[12]\b/i,
  /\bMVP\b/i,
  /placeholder/i,
  /\bTODO\b/i,
  /debug/i,
  /internal/i,
  /operator/i,
  /feature[- ]flag/i,
  /not implemented/i,
  /coming later/i,
  /\bstub\b/i,
  /scaffold/i,
  /Advanced Reporting:\s*Yes/i,
  /Real shop data only/i,
  /no charts, exports, PDFs/i,
  /Stripe, or billing actions/i,
  /in this phase/i
];
const REQUIRED_DOC_SECURITY_HEADERS = [
  'content-security-policy',
  'permissions-policy',
  'referrer-policy',
  'x-content-type-options'
];
const REQUIRED_DIRECT_ROUTES = [
  '/',
  '/docs',
  '/docs/',
  '/docs.html',
  '/docs/getting-started',
  '/docs/jobs',
  '/docs/inventory-and-parts',
  '/docs/shipping-and-custody',
  '/docs/faq'
];

const originalFetch = globalThis.fetch;

try {
  testPublicDocsCopyDenyList();
  testDocsRunWorkerFirstConfig();
  await testLandingPageIncludesLaunchAssets();
  await testBundledFaviconAssetRoute();
  await testBetaTesterChecklistRoutes();
  await testSuccessfulApplication();
  await testSupabaseFailureBlocksSuccess();
  await testEmailFailureDoesNotLoseSavedApplication();
  await testArchiveFailureDoesNotLoseSavedApplication();
  await testValidationFailureDoesNotCallSupabase();
  await testInvalidJson();
  console.log('Landing Worker checks passed.');
} finally {
  globalThis.fetch = originalFetch;
}

function testPublicDocsCopyDenyList() {
  const publicDir = path.resolve('cloudflare/frettrack-coming-soon/public');
  const docsDir = path.join(publicDir, 'docs');
  const files = [
    path.join(publicDir, 'docs.html'),
    ...fs.readdirSync(docsDir)
      .filter((fileName) => fileName.endsWith('.html'))
      .map((fileName) => path.join(docsDir, fileName))
  ];

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    for (const pattern of PUBLIC_DOC_DENY_PATTERNS) {
      assert.doesNotMatch(text, pattern, `${path.relative(process.cwd(), filePath)} contains public-docs copy leak: ${pattern}`);
    }
  }
}

function testDocsRunWorkerFirstConfig() {
  const wranglerConfig = fs.readFileSync('cloudflare/frettrack-coming-soon/wrangler.jsonc', 'utf8');
  assert.match(wranglerConfig, /"run_worker_first"\s*:\s*true/, 'Landing assets must run through the Worker before static asset serving.');
  assert.match(wranglerConfig, /"html_handling"\s*:\s*"none"/, 'Asset HTML handling must not redirect clean docs routes.');
}

async function testLandingPageIncludesLaunchAssets() {
  const response = await worker.fetch(new Request('https://frettrack-app.com/'), baseEnv());
  const html = await response.text();

  assert.equal(response.status, 200);
  assertNoRedirect(response, '/');
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png">/);
  assert.match(html, /Request Beta Access/);
  assert.match(html, /\/landing\/overview\.jpg/);
  assert.match(html, /Stripe-powered account management planned/);
  assert.match(html, /https:\/\/devglobe\.app\/projects\/frettrack\?utm_source=badge&utm_medium=embed/);
  assert.match(html, /Launched on DevGlobe/);
  assert.match(html, /href="\/docs"/);
  assert.match(html, /href="\/beta-tester"/);
  assert.match(html, /href="\/support"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /Beta Tester Checklist/);
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

async function testBetaTesterChecklistRoutes() {
  const assetCalls = [];
  const env = {
    ...baseEnv(),
    LANDING_ASSETS: {
      async fetch(request) {
        const pathname = new URL(request.url).pathname;
        assetCalls.push(pathname);
        if (pathname === '/beta-tester.html') {
          return new Response('<!doctype html><title>FretTrack Beta Testing Checklist</title><a href="/downloads/frettrack-beta-tester-workbook.xlsx">Download workbook</a><a href="/downloads/frettrack-beta-tester-checklist.csv">CSV fallback</a>', {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });
        }
        if (pathname === '/docs.html') {
          return new Response('<!doctype html><title>Docs | FretTrack</title><h1>FretTrack Docs</h1><a href="/support">Support</a><a href="/beta-tester">Beta Tester Checklist</a>', {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });
        }
        if (pathname === '/docs/docs.css') {
          return new Response('body { color: #17202b; }', {
            headers: { 'content-type': 'text/css; charset=utf-8' }
          });
        }
        const docsPage = PUBLIC_DOC_ROUTES.find((candidate) => candidate.assetPath === pathname);
        if (docsPage) {
          return new Response(`<!doctype html><title>${docsPage.title} | FretTrack Docs</title><h1>${docsPage.title}</h1><a href="/docs">Back to Docs</a>`, {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });
        }
        if (pathname === '/privacy.html') {
          return new Response('<!doctype html><title>Privacy Policy | FretTrack</title><h1>Privacy Policy</h1>', {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });
        }
        if (pathname === '/support.html') {
          return new Response('<!doctype html><title>Support | FretTrack</title><h1>Support</h1>', {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });
        }
        if (pathname === '/terms.html') {
          return new Response('<!doctype html><title>Terms of Service | FretTrack</title><h1>Terms of Service</h1>', {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });
        }
        if (pathname === '/downloads/frettrack-beta-tester-workbook.xlsx') {
          return new Response('workbook-bytes', {
            headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
          });
        }
        if (pathname === '/downloads/frettrack-beta-tester-checklist.csv') {
          return new Response('"Section","Test ID"', {
            headers: { 'content-type': 'text/csv; charset=utf-8' }
          });
        }
        return new Response('not found', { status: 404 });
      }
    }
  };

  const pageResponse = await worker.fetch(new Request('https://frettrack-app.com/beta-tester'), env);
  const pageHtml = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers.get('content-type') || '', /text\/html/);
  assert.match(pageHtml, /FretTrack Beta Testing Checklist/);
  assert.match(pageHtml, /frettrack-beta-tester-workbook\.xlsx/);
  assert.match(pageHtml, /frettrack-beta-tester-checklist\.csv/);

  const docsResponse = await worker.fetch(new Request('https://frettrack-app.com/docs'), env);
  const docsHtml = await docsResponse.text();
  assert.equal(docsResponse.status, 200);
  assertNoRedirect(docsResponse, '/docs');
  assert.match(docsResponse.headers.get('content-type') || '', /text\/html/);
  assertRequiredDocSecurityHeaders(docsResponse, '/docs');
  assert.match(docsHtml, /FretTrack Docs/);
  assert.match(docsHtml, /Beta Tester Checklist/);

  const docsHtmlResponse = await worker.fetch(new Request('https://frettrack-app.com/docs.html'), env);
  assert.equal(docsHtmlResponse.status, 200);
  assertNoRedirect(docsHtmlResponse, '/docs.html');
  assert.match(docsHtmlResponse.headers.get('content-type') || '', /text\/html/);
  assertRequiredDocSecurityHeaders(docsHtmlResponse, '/docs.html');

  const docsCssResponse = await worker.fetch(new Request('https://frettrack-app.com/docs/docs.css'), env);
  assert.equal(docsCssResponse.status, 200);
  assert.match(docsCssResponse.headers.get('content-type') || '', /text\/css/);
  assert.equal(docsCssResponse.headers.get('cache-control'), 'public, max-age=3600');

  for (const docsPage of PUBLIC_DOC_ROUTES) {
    const cleanResponse = await worker.fetch(new Request(`https://frettrack-app.com${docsPage.route}`), env);
    const cleanHtml = await cleanResponse.text();
    assert.equal(cleanResponse.status, 200, docsPage.route);
    assertNoRedirect(cleanResponse, docsPage.route);
    assert.match(cleanResponse.headers.get('content-type') || '', /text\/html/);
    assertRequiredDocSecurityHeaders(cleanResponse, docsPage.route);
    assert.match(cleanHtml, new RegExp(escapeRegExp(docsPage.title)));
    assert.match(cleanHtml, /Back to Docs/);

    const htmlResponse = await worker.fetch(new Request(`https://frettrack-app.com${docsPage.assetPath}`), env);
    const htmlText = await htmlResponse.text();
    assert.equal(htmlResponse.status, 200, docsPage.assetPath);
    assertNoRedirect(htmlResponse, docsPage.assetPath);
    assert.match(htmlResponse.headers.get('content-type') || '', /text\/html/);
    assertRequiredDocSecurityHeaders(htmlResponse, docsPage.assetPath);
    assert.match(htmlText, new RegExp(escapeRegExp(docsPage.title)));
  }

  const workbookResponse = await worker.fetch(new Request('https://frettrack-app.com/downloads/frettrack-beta-tester-workbook.xlsx'), env);
  assert.equal(workbookResponse.status, 200);
  assert.match(workbookResponse.headers.get('content-type') || '', /spreadsheetml\.sheet/);
  assert.equal(workbookResponse.headers.get('cache-control'), 'public, max-age=3600');
  assert.equal(await workbookResponse.text(), 'workbook-bytes');

  const csvResponse = await worker.fetch(new Request('https://frettrack-app.com/downloads/frettrack-beta-tester-checklist.csv'), env);
  const csvText = await csvResponse.text();
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get('content-type') || '', /text\/csv/);
  assert.equal(csvResponse.headers.get('cache-control'), 'public, max-age=3600');
  assert.match(csvText, /"Section","Test ID"/);

  const privacyResponse = await worker.fetch(new Request('https://frettrack-app.com/privacy'), env);
  const privacyHtml = await privacyResponse.text();
  assert.equal(privacyResponse.status, 200);
  assert.match(privacyResponse.headers.get('content-type') || '', /text\/html/);
  assert.match(privacyHtml, /Privacy Policy/);

  const privacyHtmlResponse = await worker.fetch(new Request('https://frettrack-app.com/privacy.html'), env);
  assert.equal(privacyHtmlResponse.status, 200);
  assert.match(privacyHtmlResponse.headers.get('content-type') || '', /text\/html/);

  const supportResponse = await worker.fetch(new Request('https://frettrack-app.com/support'), env);
  const supportHtml = await supportResponse.text();
  assert.equal(supportResponse.status, 200);
  assert.match(supportResponse.headers.get('content-type') || '', /text\/html/);
  assert.match(supportHtml, /Support/);

  const supportHtmlResponse = await worker.fetch(new Request('https://frettrack-app.com/support.html'), env);
  assert.equal(supportHtmlResponse.status, 200);
  assert.match(supportHtmlResponse.headers.get('content-type') || '', /text\/html/);

  const termsResponse = await worker.fetch(new Request('https://frettrack-app.com/terms'), env);
  const termsHtml = await termsResponse.text();
  assert.equal(termsResponse.status, 200);
  assert.match(termsResponse.headers.get('content-type') || '', /text\/html/);
  assert.match(termsHtml, /Terms of Service/);

  const termsHtmlResponse = await worker.fetch(new Request('https://frettrack-app.com/terms.html'), env);
  assert.equal(termsHtmlResponse.status, 200);
  assert.match(termsHtmlResponse.headers.get('content-type') || '', /text\/html/);

  for (const expectedPath of [
    '/beta-tester.html',
    '/docs.html',
    '/docs/docs.css',
    '/downloads/frettrack-beta-tester-workbook.xlsx',
    '/downloads/frettrack-beta-tester-checklist.csv',
    '/privacy.html',
    '/support.html',
    '/terms.html',
    ...PUBLIC_DOC_ROUTES.flatMap((docsPage) => [docsPage.assetPath])
  ]) {
    assert.ok(assetCalls.includes(expectedPath), `Expected bundled asset request for ${expectedPath}`);
  }

  for (const route of REQUIRED_DIRECT_ROUTES) {
    const response = await worker.fetch(new Request(`https://frettrack-app.com${route === '/' ? '' : route}`), env);
    assert.equal(response.status, 200, `${route} must return 200 directly.`);
    assertNoRedirect(response, route);
  }
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

function assertRequiredDocSecurityHeaders(response, route) {
  for (const header of REQUIRED_DOC_SECURITY_HEADERS) {
    assert.ok(response.headers.get(header), `${route} is missing ${header}.`);
  }

  assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/, `${route} has an unexpected CSP.`);
  assert.match(response.headers.get('permissions-policy') || '', /camera=\(\), microphone=\(\), geolocation=\(\)/, `${route} has an unexpected Permissions-Policy.`);
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', `${route} has an unexpected Referrer-Policy.`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${route} has an unexpected X-Content-Type-Options.`);
}

function assertNoRedirect(response, route) {
  assert.ok(response.status < 300 || response.status >= 400, `${route} returned redirect status ${response.status}.`);
  assert.equal(response.headers.get('location'), null, `${route} returned a Location header.`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
