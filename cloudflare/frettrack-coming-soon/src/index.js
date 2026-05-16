const APP_URL = 'https://app.frettrack-app.com';
const SUPPORT_EMAIL = 'support@frettrack-app.com';

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
    <meta property="og:image" content="${APP_URL}/frettrack-banner.png">
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
        background: url("${APP_URL}/frettrack-banner.png") center / cover no-repeat;
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
      }
    </style>
  </head>
  <body>
    <section class="hero">
      <nav class="nav" aria-label="Main">
        <div class="brand">
          <img src="${APP_URL}/frettrack-emblem.png" alt="">
          <span>FretTrack</span>
        </div>
        <a href="${APP_URL}">Beta Login</a>
      </nav>

      <div class="hero-inner">
        <p class="eyebrow">Private beta now in progress</p>
        <h1>Repair shop workflow for instruments that actually leave the bench.</h1>
        <p class="intro">FretTrack helps guitar repair shops manage check-ins, customers, repair jobs, photos, parts, services, payments, and printable work sheets in one focused workspace.</p>
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
  </body>
</html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.hostname === 'www.frettrack-app.com') {
      url.hostname = 'frettrack-app.com';
      return Response.redirect(url.toString(), 301);
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
