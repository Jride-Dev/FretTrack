const APP_URL = 'https://app.frettrack-app.com';
const SUPPORT_EMAIL = 'support@frettrack-app.com';
const BANNER_URL = '/assets/frettrack-banner.png';
const EMBLEM_URL = '/assets/frettrack-emblem.png';

function landingPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FretTrack | Private Beta</title>
    <meta name="description" content="FretTrack is a private beta repair workflow for guitar shops: jobs, customers, photos, service records, and printable repair sheets.">
    <meta property="og:title" content="FretTrack | Private Beta">
    <meta property="og:description" content="Guitar repair workflow, jobs, photos, customers, and shop records.">
    <meta property="og:image" content="https://frettrack-app.com${BANNER_URL}">
    <meta property="og:type" content="website">
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --muted: #4b5563;
        --paper: #f4f1ea;
        --panel: #ffffff;
        --line: #d9d1c2;
        --brand: #9a4d14;
        --brand-dark: #6f350d;
        --charcoal: #151922;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }

      a {
        color: inherit;
      }

      .hero {
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr auto;
        background: url("${BANNER_URL}") center / cover no-repeat;
        color: #ffffff;
        isolation: isolate;
        position: relative;
      }

      .hero::before {
        background: rgba(17, 24, 39, 0.82);
        content: "";
        inset: 0;
        position: absolute;
        z-index: -1;
      }

      .nav,
      .hero-inner,
      .lower {
        width: min(1120px, calc(100% - 40px));
        margin: 0 auto;
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 22px 0;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 800;
        letter-spacing: 0;
      }

      .brand img {
        width: 44px;
        height: 44px;
        border-radius: 6px;
        object-fit: cover;
      }

      .nav a {
        border: 1px solid rgba(255, 255, 255, 0.34);
        border-radius: 6px;
        font-size: 14px;
        font-weight: 700;
        padding: 10px 14px;
        text-decoration: none;
      }

      .hero-inner {
        align-self: center;
        padding: 44px 0 64px;
      }

      .eyebrow {
        color: #f4d6b4;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.08em;
        margin: 0 0 14px;
        text-transform: uppercase;
      }

      h1 {
        font-size: clamp(42px, 9vw, 92px);
        line-height: 0.98;
        margin: 0;
        max-width: 860px;
      }

      .intro {
        color: #e5e7eb;
        font-size: clamp(18px, 2.2vw, 24px);
        margin: 22px 0 0;
        max-width: 720px;
      }

      .origin-note {
        color: #f4d6b4;
        font-size: 16px;
        font-weight: 800;
        margin: 18px 0 0;
        max-width: 720px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 34px;
      }

      .button {
        align-items: center;
        border-radius: 6px;
        display: inline-flex;
        font-weight: 800;
        min-height: 48px;
        padding: 12px 18px;
        text-decoration: none;
      }

      .button.primary {
        background: #ffffff;
        color: var(--charcoal);
      }

      .button.secondary {
        border: 1px solid rgba(255, 255, 255, 0.42);
        color: #ffffff;
      }

      .beta-callout {
        background: var(--charcoal);
        color: #ffffff;
      }

      .beta-callout .section {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 32px 0;
      }

      .beta-callout h2 {
        font-size: clamp(26px, 4vw, 42px);
        line-height: 1.05;
        margin: 0;
      }

      .beta-callout p {
        color: #d1d5db;
        font-size: 17px;
        margin: 8px 0 0;
        max-width: 680px;
      }

      .beta-callout .button {
        background: #ffffff;
        border: 0;
        color: var(--charcoal);
        cursor: pointer;
        flex: 0 0 auto;
        font-family: inherit;
        font-size: 15px;
      }

      .modal-backdrop {
        align-items: center;
        background: rgba(17, 24, 39, 0.72);
        display: none;
        inset: 0;
        justify-content: center;
        padding: 20px;
        position: fixed;
        z-index: 20;
      }

      .modal-backdrop:target {
        display: flex;
      }

      body.modal-open {
        overflow: hidden;
      }

      body.modal-open .modal-backdrop {
        display: flex;
      }

      .modal {
        background: var(--panel);
        border-radius: 8px;
        color: var(--ink);
        max-height: min(720px, calc(100vh - 40px));
        max-width: 560px;
        overflow: auto;
        padding: 24px;
        width: min(100%, 560px);
      }

      .modal-header {
        align-items: flex-start;
        display: flex;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 16px;
      }

      .modal h2 {
        font-size: 28px;
        line-height: 1.12;
        margin: 0;
      }

      .modal p {
        color: var(--muted);
        margin: 8px 0 0;
      }

      .modal-close {
        background: transparent;
        border: 1px solid var(--line);
        border-radius: 6px;
        color: var(--ink);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        height: 36px;
        line-height: 1;
        text-decoration: none;
        width: 36px;
      }

      .application-form {
        display: grid;
        gap: 12px;
      }

      .application-form label {
        color: var(--ink);
        display: grid;
        font-size: 14px;
        font-weight: 700;
        gap: 6px;
      }

      .application-form input,
      .application-form textarea {
        border: 1px solid var(--line);
        border-radius: 6px;
        color: var(--ink);
        font: inherit;
        min-height: 42px;
        padding: 10px 12px;
        width: 100%;
      }

      .application-form textarea {
        min-height: 92px;
        resize: vertical;
      }

      .application-form .button {
        background: var(--brand);
        border: 0;
        color: #ffffff;
        cursor: pointer;
        font-family: inherit;
        justify-content: center;
        margin-top: 6px;
      }

      .form-status {
        color: var(--muted);
        font-size: 14px;
        margin: 2px 0 0;
        min-height: 20px;
      }

      .form-status.success {
        color: #0f766e;
      }

      .form-status.error {
        color: #b3261e;
      }

      .lower {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        padding: 0 0 28px;
      }

      .fact {
        border-top: 1px solid rgba(255, 255, 255, 0.35);
        padding-top: 14px;
      }

      .fact strong {
        display: block;
        font-size: 15px;
      }

      .fact span {
        color: #d1d5db;
        display: block;
        font-size: 14px;
        margin-top: 4px;
      }

      main {
        background: var(--paper);
      }

      .section {
        width: min(1120px, calc(100% - 40px));
        margin: 0 auto;
        padding: 54px 0;
      }

      .section h2 {
        font-size: clamp(28px, 4vw, 44px);
        line-height: 1.05;
        margin: 0 0 14px;
      }

      .section p {
        color: var(--muted);
        font-size: 18px;
        margin: 0;
        max-width: 760px;
      }

      .feature-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 30px;
      }

      .feature {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 18px;
      }

      .feature h3 {
        font-size: 18px;
        margin: 0 0 8px;
      }

      .feature p {
        font-size: 15px;
      }

      footer {
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 14px;
        padding: 22px 0;
      }

      footer .section {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 0;
      }

      @media (max-width: 760px) {
        .nav,
        .hero-inner,
        .lower,
        .section {
          width: min(100% - 28px, 1120px);
        }

        .nav {
          align-items: flex-start;
          flex-direction: column;
        }

        .lower,
        .feature-grid,
        footer .section {
          grid-template-columns: 1fr;
        }

        .lower {
          display: grid;
        }

        footer .section {
          display: grid;
        }

        .beta-callout .section {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    </style>
  </head>
  <body>
    <section class="hero">
      <nav class="nav" aria-label="Main">
        <div class="brand">
          <img src="${EMBLEM_URL}" alt="">
          <span>FretTrack</span>
        </div>
        <a href="${APP_URL}">Beta Login</a>
      </nav>

      <div class="hero-inner">
        <p class="eyebrow">Private beta now in progress</p>
        <h1>Repair shop workflow for instruments that actually leave the bench.</h1>
        <p class="intro">FretTrack helps guitar repair shops manage check-ins, customers, repair jobs, photos, parts, services, payments, and printable work sheets in one focused workspace.</p>
        <p class="origin-note">Made by a guitar player and technician for guitar technicians.</p>
        <div class="actions">
          <a class="button primary" href="${APP_URL}">Go to Beta Login</a>
          <a class="button secondary" href="mailto:${SUPPORT_EMAIL}">Contact FretTrack</a>
        </div>
      </div>

      <div class="lower" aria-label="Beta status">
        <div class="fact">
          <strong>Limited tester access</strong>
          <span>No public signup while the beta is being tightened.</span>
        </div>
        <div class="fact">
          <strong>Built for repair flow</strong>
          <span>Jobs, photos, damage notes, customer lookup, and print sheets.</span>
        </div>
        <div class="fact">
          <strong>Beta feedback wanted</strong>
          <span>Real shop use is shaping what gets fixed first.</span>
        </div>
      </div>
    </section>

    <main>
      <section class="beta-callout" aria-labelledby="beta-heading">
        <div class="section">
          <div>
            <h2 id="beta-heading">Shop Owners Wanted for Beta Testing!</h2>
            <p>We are looking for a few real repair shops to test FretTrack with actual bench work, photos, customer lookup, and repair sheets.</p>
          </div>
          <a class="button" href="#application-modal" id="open-application">APPLY HERE</a>
        </div>
      </section>

      <section class="section">
        <h2>Made for small repair shops, not generic ticket queues.</h2>
        <p>FretTrack is being tested with real guitar repair workflows: intake notes, instrument condition, job history, parts and services, shop branding, and customer-ready printouts.</p>
        <div class="feature-grid">
          <div class="feature">
            <h3>Job records</h3>
            <p>Track repair status, customer details, services, parts, payments, and shop-scoped job numbers.</p>
          </div>
          <div class="feature">
            <h3>Photo documentation</h3>
            <p>Attach work order photos and damage-map views so condition notes stay tied to the repair.</p>
          </div>
          <div class="feature">
            <h3>Printable sheets</h3>
            <p>Generate shop-branded job sheets and customer damage reports for handoff and records.</p>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <div class="section">
        <span>FretTrack Systems</span>
        <span><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></span>
      </div>
    </footer>

    <div class="modal-backdrop" id="application-modal" role="presentation">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="application-title">
        <div class="modal-header">
          <div>
            <h2 id="application-title">Beta tester application</h2>
            <p>Tell us a little about your shop so we can keep this beta useful and controlled.</p>
          </div>
          <a class="modal-close" href="#" id="close-application" aria-label="Close application">X</a>
        </div>
        <form class="application-form" id="application-form">
          <label>
            Name
            <input name="name" autocomplete="name" required>
          </label>
          <label>
            State
            <input name="state" autocomplete="address-level1" required>
          </label>
          <label>
            Shop Name
            <input name="shopName" autocomplete="organization" required>
          </label>
          <label>
            How many people work at your shop?
            <input name="teamSize" inputmode="numeric" required>
          </label>
          <label>
            What are you using now to track your bench work?
            <textarea name="currentTracking" required></textarea>
          </label>
          <label>
            Email address
            <input name="email" type="email" autocomplete="email" required>
          </label>
          <button class="button" type="submit">Submit Application</button>
          <p class="form-status" id="application-status" aria-live="polite"></p>
        </form>
      </div>
    </div>

    <script>
      const body = document.body;
      const openButton = document.getElementById('open-application');
      const closeButton = document.getElementById('close-application');
      const modal = document.getElementById('application-modal');
      const form = document.getElementById('application-form');
      const status = document.getElementById('application-status');

      function openModal() {
        body.classList.add('modal-open');
        status.textContent = '';
        status.className = 'form-status';
        form.elements.name.focus();
      }

      function closeModal() {
        body.classList.remove('modal-open');
        openButton.focus();
      }

      openButton.addEventListener('click', openModal);
      closeButton.addEventListener('click', closeModal);
      window.addEventListener('hashchange', () => {
        if (window.location.hash === '#application-modal') {
          openModal();
        } else {
          body.classList.remove('modal-open');
        }
      });
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && body.classList.contains('modal-open')) closeModal();
      });

      if (window.location.hash === '#application-modal') {
        openModal();
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        const payload = Object.fromEntries(new FormData(form).entries());

        submitButton.disabled = true;
        status.textContent = 'Submitting...';
        status.className = 'form-status';

        try {
          const response = await fetch('/api/beta-application', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const result = await response.json();
          if (!response.ok || !result.ok) {
            throw new Error(result.error || 'Unable to submit right now.');
          }
          form.reset();
          status.textContent = result.warning
            ? result.message + ' ' + result.warning
            : (result.message || 'Application received. You\'ll be contacted or approved before workspace access is enabled.');
          status.className = 'form-status success';
        } catch (error) {
          status.textContent = error.message || 'Unable to submit right now.';
          status.className = 'form-status error';
        } finally {
          submitButton.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'www.frettrack-app.com') {
      url.hostname = 'frettrack-app.com';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname.startsWith('/assets/')) {
      return serveAsset(url.pathname, env);
    }

    if (url.pathname === '/api/beta-application') {
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
      }
      return saveBetaApplication(request, env);
    }

    if (url.pathname === '/app') {
      return Response.redirect(APP_URL, 302);
    }

    return new Response(landingPage(), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'x-content-type-options': 'nosniff'
      }
    });
  }
};

async function saveBetaApplication(request, env) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return jsonResponse({ ok: false, error: 'Invalid request.' }, 400);
  }

  let data;
  try {
    data = await request.json();
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Invalid request.' }, 400);
  }

  const application = {
    name: cleanText(data.name, 120),
    state: cleanText(data.state, 80),
    shopName: cleanText(data.shopName, 160),
    teamSize: cleanText(data.teamSize, 80),
    currentTracking: cleanText(data.currentTracking, 1200),
    email: cleanText(data.email, 180).toLowerCase(),
    submittedAt: new Date().toISOString(),
    userAgent: cleanText(request.headers.get('user-agent') || '', 500),
    ipCountry: cleanText(request.cf?.country || '', 8)
  };

  const missingField = ['name', 'state', 'shopName', 'teamSize', 'currentTracking', 'email'].find((field) => !application[field]);
  if (missingField) {
    return jsonResponse({ ok: false, error: 'Please fill out every field.' }, 400);
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(application.email)) {
    return jsonResponse({ ok: false, error: 'Please enter a valid email address.' }, 400);
  }

  try {
    const applicationResult = await submitBetaAccessRequest(application, env);
    const emailResult = await sendBetaApplicationEmails(application, env);
    await archiveBetaApplication(application, env);

    const responseBody = {
      ok: true,
      message: 'Application received. You\'ll be contacted or approved before workspace access is enabled.'
    };

    if (emailResult.warning) {
      responseBody.warning = emailResult.warning;
    }

    if (applicationResult?.status) {
      responseBody.status = applicationResult.status;
    }

    return jsonResponse(responseBody);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || 'Unable to submit right now.' }, 500);
  }
}

async function submitBetaAccessRequest(application, env) {
  const supabaseUrl = cleanText(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '', 300).replace(/\/+$/, '');
  const supabaseAnonKey = cleanText(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '', 1000);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Beta application service is not configured.');
  }

  const notes = [
    `State: ${application.state}`,
    `Team size: ${application.teamSize}`,
    `Current tracking: ${application.currentTracking}`,
    `Submitted: ${application.submittedAt}`,
    application.ipCountry ? `Country: ${application.ipCountry}` : ''
  ].filter(Boolean).join('\n');

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_beta_access_request`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      applicant_email: application.email,
      applicant_name: application.name,
      applicant_shop_name: application.shopName,
      applicant_notes: notes
    })
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.message || result?.error || 'Unable to submit right now.');
  }

  return result;
}

async function sendBetaApplicationEmails(application, env) {
  const resendApiKey = cleanText(env.RESEND_API_KEY || '', 300);
  const fromEmail = cleanText(env.SHOP_EMAIL_FROM || '', 180) || 'FretTrack <noreply@frettrack-app.com>';
  const notifyTo = cleanText(env.BETA_APPLICATION_NOTIFY_TO || SUPPORT_EMAIL, 180);

  if (!resendApiKey || !fromEmail) {
    return {
      warning: 'Application saved, but email delivery is not configured on the landing-page Worker yet.'
    };
  }

  const details = [
    `Name: ${application.name}`,
    `Email: ${application.email}`,
    `State: ${application.state}`,
    `Shop Name: ${application.shopName}`,
    `Team Size: ${application.teamSize}`,
    `Current Tracking: ${application.currentTracking}`,
    `Submitted: ${application.submittedAt}`,
    application.ipCountry ? `Country: ${application.ipCountry}` : '',
    application.userAgent ? `User Agent: ${application.userAgent}` : ''
  ].filter(Boolean).join('\n');

  const applicantText = [
    'Thanks for applying for the FretTrack beta.',
    '',
    'Your application has been received and is waiting on operator review.',
    'You will be contacted or approved before workspace access is enabled.',
    '',
    'Application summary:',
    details
  ].join('\n');

  const operatorText = [
    'New FretTrack beta application received.',
    '',
    details
  ].join('\n');

  const results = await Promise.allSettled([
    sendResendEmail({
      apiKey: resendApiKey,
      from: fromEmail,
      to: application.email,
      subject: 'FretTrack beta application received',
      text: applicantText
    }),
    sendResendEmail({
      apiKey: resendApiKey,
      from: fromEmail,
      to: notifyTo,
      subject: `New FretTrack beta application: ${application.shopName || application.email}`,
      text: operatorText
    })
  ]);

  const failures = results
    .filter((result) => result.status === 'rejected' || result.value?.ok === false)
    .map((result) => result.reason?.message || result.value?.error || 'Email send failed.');

  if (failures.length) {
    return {
      warning: `Application saved, but email delivery had an issue: ${failures[0]}`
    };
  }

  return { warning: '' };
}

async function sendResendEmail({ apiKey, from, to, subject, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, text })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || 'Resend send failed.');
  }

  return { ok: true, id: result.id || '' };
}

async function archiveBetaApplication(application, env) {
  if (!env.FRETTRACK_APP_ASSETS) {
    return;
  }

  const id = crypto.randomUUID();
  const datePath = application.submittedAt.slice(0, 10);
  await env.FRETTRACK_APP_ASSETS.put(
    `beta-applications/${datePath}/${id}.json`,
    JSON.stringify(application, null, 2),
    {
      httpMetadata: {
        contentType: 'application/json',
        cacheControl: 'private, max-age=0'
      }
    }
  );
}

async function serveAsset(pathname, env) {
  const key = `site/${pathname.replace('/assets/', '')}`;
  const object = await env.FRETTRACK_APP_ASSETS.get(key);

  if (!object) {
    return new Response('Asset not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', object.httpMetadata?.cacheControl || 'public, max-age=300');

  return new Response(object.body, { headers });
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}
