const APP_URL = 'https://app.frettrack-app.com';
const SUPPORT_EMAIL = 'support@frettrack-app.com';
const BANNER_URL = '/assets/frettrack-banner.png';
const BUNDLED_ASSET_PATHS = new Set([
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/site.webmanifest',
  '/beta-tester.html',
  '/downloads/frettrack-beta-tester-checklist.csv'
]);

function landingPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FretTrack | Guitar Repair Shop Workflow</title>
    <meta name="description" content="FretTrack is repair shop workflow software for guitar and bass technicians: intake, jobs, photos, damage maps, inventory, scheduling, customer documents, and shop records.">
    <link rel="canonical" href="https://frettrack-app.com/">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#0b1118">
    <meta property="og:title" content="FretTrack | Guitar Repair Shop Workflow">
    <meta property="og:description" content="Run intake, repair jobs, photos, inventory, scheduling, and customer documents in one focused shop workspace.">
    <meta property="og:image" content="https://frettrack-app.com/landing/overview.jpg">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://frettrack-app.com/">
    <meta name="twitter:card" content="summary_large_image">
    <style>
      :root {
        color-scheme: dark light;
        --ink: #f7fafc;
        --muted: #b8c2cc;
        --quiet: #718096;
        --paper: #f7f3ea;
        --paper-ink: #17202b;
        --paper-muted: #566171;
        --night: #0b1118;
        --panel: #121a25;
        --panel-2: #192231;
        --line: rgba(184, 194, 204, 0.2);
        --line-strong: rgba(255, 255, 255, 0.26);
        --amber: #f59e0b;
        --amber-dark: #b45309;
        --teal: #16c7a3;
        --blue: #78b7ff;
        --danger: #f87171;
        --success: #20c997;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        background: var(--night);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }

      a {
        color: inherit;
      }

      img {
        display: block;
        max-width: 100%;
      }

      .site-shell {
        background:
          linear-gradient(180deg, rgba(11, 17, 24, 0.92), rgba(11, 17, 24, 0.98)),
          url("${BANNER_URL}") center top / cover no-repeat;
      }

      .nav,
      .hero,
      .section,
      .footer-inner {
        width: min(1180px, calc(100% - 40px));
        margin: 0 auto;
      }

      .nav {
        align-items: center;
        display: flex;
        gap: 22px;
        justify-content: space-between;
        padding: 22px 0;
      }

      .brand {
        align-items: center;
        display: flex;
        gap: 12px;
        min-width: 180px;
        text-decoration: none;
      }

      .brand img {
        background: #05080d;
        border: 1px solid var(--line-strong);
        border-radius: 8px;
        height: 46px;
        object-fit: cover;
        width: 46px;
      }

      .brand-text {
        display: block;
      }

      .brand strong {
        color: #ffffff;
        display: block;
        font-size: 18px;
        letter-spacing: 0;
        line-height: 1;
      }

      .brand-text span {
        color: var(--amber);
        display: block;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.05em;
        line-height: 1.1;
        margin-top: 5px;
        text-transform: uppercase;
      }

      .nav-links {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-end;
      }

      .nav-links a {
        border-radius: 6px;
        color: #dbe5ef;
        font-size: 14px;
        font-weight: 750;
        padding: 9px 10px;
        text-decoration: none;
      }

      .nav-links a:hover,
      .nav-links a:focus-visible {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        outline: 2px solid transparent;
      }

      .nav-links .login {
        border: 1px solid var(--line-strong);
        color: #ffffff;
        padding-inline: 14px;
      }

      .hero {
        align-items: center;
        display: grid;
        gap: 44px;
        grid-template-columns: minmax(0, 0.88fr) minmax(420px, 1.12fr);
        min-height: calc(100vh - 92px);
        padding: 36px 0 76px;
      }

      h1 {
        font-size: clamp(56px, 9vw, 112px);
        line-height: 0.9;
        margin: 0;
        max-width: 720px;
      }

      .hero-subtitle {
        color: #d9e2ec;
        font-size: clamp(22px, 3vw, 34px);
        font-weight: 780;
        line-height: 1.08;
        margin: 18px 0 0;
        max-width: 760px;
      }

      .hero-copy {
        color: var(--muted);
        font-size: clamp(17px, 1.7vw, 20px);
        margin: 20px 0 0;
        max-width: 680px;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 32px;
      }

      .button {
        align-items: center;
        border-radius: 8px;
        display: inline-flex;
        font-size: 15px;
        font-weight: 850;
        justify-content: center;
        min-height: 48px;
        padding: 12px 18px;
        text-decoration: none;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
      }

      .button:hover,
      .button:focus-visible {
        outline: 2px solid rgba(120, 183, 255, 0.7);
        outline-offset: 3px;
        transform: translateY(-1px);
      }

      .button.primary {
        background: var(--amber);
        border: 1px solid #ffc56b;
        color: #12151c;
      }

      .button.primary:hover,
      .button.primary:focus-visible {
        background: #ffb52e;
        color: #0b1118;
      }

      .button.secondary {
        border: 1px solid var(--line-strong);
        color: #ffffff;
      }

      .hero-note {
        color: #e8eef6;
        font-size: 14px;
        margin: 18px 0 0;
        max-width: 580px;
      }

      .product-frame {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04));
        border: 1px solid var(--line-strong);
        border-radius: 10px;
        box-shadow: 0 34px 80px rgba(0, 0, 0, 0.46);
        overflow: hidden;
        position: relative;
      }

      .frame-bar {
        align-items: center;
        background: rgba(8, 13, 20, 0.9);
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 8px;
        padding: 12px 14px;
      }

      .frame-dot {
        background: #4a5568;
        border-radius: 999px;
        height: 9px;
        width: 9px;
      }

      .frame-title {
        color: #c8d2df;
        font-size: 12px;
        font-weight: 800;
        margin-left: 8px;
      }

      .product-frame img {
        aspect-ratio: 16 / 9;
        object-fit: cover;
        object-position: left top;
        width: 100%;
      }

      .hero-proof {
        border-top: 1px solid var(--line);
        display: grid;
        gap: 0;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 22px;
      }

      .proof-item {
        border-right: 1px solid var(--line);
        padding: 16px;
      }

      .proof-item:last-child {
        border-right: 0;
      }

      .proof-item strong {
        color: #ffffff;
        display: block;
        font-size: 15px;
      }

      .proof-item span {
        color: var(--muted);
        display: block;
        font-size: 13px;
        margin-top: 4px;
      }

      main {
        background: var(--paper);
        color: var(--paper-ink);
      }

      .section {
        padding: 74px 0;
      }

      .section h2 {
        font-size: clamp(32px, 5vw, 58px);
        line-height: 0.98;
        margin: 0;
        max-width: 820px;
      }

      .section-lede {
        color: var(--paper-muted);
        font-size: clamp(17px, 1.9vw, 21px);
        margin: 18px 0 0;
        max-width: 800px;
      }

      .workflow {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin-top: 34px;
      }

      .step,
      .feature,
      .plan {
        background: #ffffff;
        border: 1px solid #d8dee8;
        border-radius: 8px;
      }

      .step {
        padding: 20px;
      }

      .step span {
        color: var(--amber-dark);
        display: block;
        font-size: 13px;
        font-weight: 900;
        margin-bottom: 10px;
      }

      .step h3,
      .feature h3,
      .plan h3 {
        font-size: 19px;
        line-height: 1.15;
        margin: 0 0 8px;
      }

      .step p,
      .feature p,
      .plan p {
        color: var(--paper-muted);
        font-size: 15px;
        margin: 0;
      }

      .dark-band {
        background: #111823;
        color: #ffffff;
      }

      .dark-band .section-lede {
        color: #b8c2cc;
      }

      .feature-layout {
        align-items: center;
        display: grid;
        gap: 36px;
        grid-template-columns: minmax(0, 0.9fr) minmax(420px, 1.1fr);
      }

      .feature-list {
        display: grid;
        gap: 12px;
        margin-top: 28px;
      }

      .feature {
        padding: 18px;
      }

      .dark-band .feature {
        background: #182232;
        border-color: rgba(255, 255, 255, 0.14);
      }

      .dark-band .feature p {
        color: #bdc8d7;
      }

      .media-stack {
        display: grid;
        gap: 14px;
      }

      .media-card {
        background: #0d1420;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 9px;
        overflow: hidden;
      }

      .media-card img {
        aspect-ratio: 16 / 9;
        object-fit: cover;
        object-position: left top;
        width: 100%;
      }

      .media-caption {
        color: #dbe5ef;
        font-size: 13px;
        font-weight: 800;
        padding: 11px 13px;
      }

      .trust-grid,
      .plan-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 34px;
      }

      .trust-item {
        border-top: 2px solid #1f2937;
        padding-top: 18px;
      }

      .trust-item strong {
        display: block;
        font-size: 18px;
        margin-bottom: 8px;
      }

      .trust-item p {
        color: var(--paper-muted);
        margin: 0;
      }

      .plan {
        display: grid;
        gap: 16px;
        padding: 22px;
      }

      .plan strong {
        color: var(--amber-dark);
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .plan ul {
        color: var(--paper-muted);
        display: grid;
        gap: 8px;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .plan li {
        padding-left: 18px;
        position: relative;
      }

      .plan li::before {
        background: var(--teal);
        border-radius: 999px;
        content: "";
        height: 7px;
        left: 0;
        position: absolute;
        top: 0.63em;
        width: 7px;
      }

      .launch-panel {
        align-items: center;
        background: #0e1520;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 10px;
        color: #ffffff;
        display: grid;
        gap: 24px;
        grid-template-columns: minmax(0, 1fr) auto;
        padding: 30px;
      }

      .launch-panel h2 {
        font-size: clamp(30px, 4vw, 52px);
      }

      .launch-panel p {
        color: #c8d2df;
        font-size: 17px;
        margin: 12px 0 0;
        max-width: 740px;
      }

      .launch-panel .button {
        background: var(--amber);
        color: #12151c;
      }

      footer {
        background: var(--night);
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        color: var(--muted);
        font-size: 14px;
      }

      .footer-inner {
        align-items: center;
        display: flex;
        gap: 16px;
        justify-content: space-between;
        padding: 26px 0;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
      }

      .footer-badge {
        align-items: center;
        display: inline-flex;
      }

      .footer-badge img {
        height: 54px;
        width: 250px;
      }

      .modal-backdrop {
        align-items: center;
        background: rgba(5, 8, 13, 0.78);
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
        background: #ffffff;
        border-radius: 9px;
        color: var(--paper-ink);
        max-height: min(760px, calc(100vh - 24px));
        max-width: 590px;
        overflow: auto;
        padding: 24px;
        width: min(100%, 590px);
      }

      .modal-header {
        align-items: flex-start;
        display: flex;
        gap: 18px;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .modal h2 {
        font-size: 30px;
        line-height: 1.08;
        margin: 0;
      }

      .modal p {
        color: var(--paper-muted);
        margin: 8px 0 0;
      }

      .modal-close {
        align-items: center;
        background: transparent;
        border: 1px solid #d8dee8;
        border-radius: 6px;
        color: var(--paper-ink);
        cursor: pointer;
        display: inline-flex;
        font-size: 20px;
        height: 36px;
        justify-content: center;
        line-height: 1;
        text-decoration: none;
        width: 36px;
      }

      .application-form {
        display: grid;
        gap: 12px;
      }

      .application-form label {
        color: var(--paper-ink);
        display: grid;
        font-size: 14px;
        font-weight: 780;
        gap: 6px;
      }

      .application-form input,
      .application-form textarea {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        color: var(--paper-ink);
        font: inherit;
        min-height: 42px;
        padding: 10px 12px;
        width: 100%;
      }

      .application-form textarea {
        min-height: 96px;
        resize: vertical;
      }

      .application-form .button {
        background: var(--amber);
        border: 1px solid #ffc56b;
        color: #111827;
        cursor: pointer;
        font-family: inherit;
        margin-top: 6px;
      }

      .application-form .button:disabled {
        background: #d8dee8;
        border-color: #cbd5e1;
        color: #64748b;
        cursor: not-allowed;
        transform: none;
      }

      .form-note,
      .form-status {
        color: var(--paper-muted);
        font-size: 14px;
        margin: 0;
      }

      .form-status {
        min-height: 20px;
      }

      .form-status.success {
        color: #0f766e;
      }

      .form-status.error {
        color: #b42318;
      }

      @media (max-width: 980px) {
        .hero,
        .feature-layout,
        .launch-panel {
          grid-template-columns: 1fr;
        }

        .hero {
          min-height: auto;
          padding-top: 22px;
        }

        .product-frame {
          order: -1;
        }

        .trust-grid,
        .plan-grid,
        .workflow {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .launch-panel {
          align-items: start;
        }
      }

      @media (max-width: 720px) {
        .nav,
        .hero,
        .section,
        .footer-inner {
          width: min(100% - 28px, 1180px);
        }

        .nav {
          align-items: flex-start;
          flex-direction: column;
        }

        .nav-links {
          justify-content: flex-start;
          width: 100%;
        }

        .nav-links a {
          padding: 8px 9px;
        }

        .hero {
          gap: 28px;
          padding-bottom: 48px;
        }

        h1 {
          font-size: clamp(48px, 18vw, 72px);
        }

        .hero-proof,
        .trust-grid,
        .plan-grid,
        .workflow {
          grid-template-columns: 1fr;
        }

        .proof-item {
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }

        .proof-item:last-child {
          border-bottom: 0;
        }

        .section {
          padding: 52px 0;
        }

        .footer-inner {
          align-items: flex-start;
          flex-direction: column;
        }

        .modal {
          max-height: calc(100vh - 12px);
          padding: 16px;
          width: min(100%, calc(100vw - 12px));
        }

        .application-form .button {
          position: sticky;
          bottom: 0;
          z-index: 1;
        }
      }
    </style>
  </head>
  <body>
    <div class="site-shell">
      <nav class="nav" aria-label="Main navigation">
        <a class="brand" href="/" aria-label="FretTrack home">
          <img src="/android-chrome-192x192.png" alt="">
          <span class="brand-text"><strong>FretTrack</strong><span>Modern workflow for guitar repair</span></span>
        </a>
        <div class="nav-links">
          <a href="#product">Product</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
          <a href="#beta">Beta</a>
          <a href="/beta-tester">Tester Checklist</a>
          <a class="login" href="${APP_URL}">Login</a>
        </div>
      </nav>

      <header class="hero">
        <div>
          <h1>FretTrack</h1>
          <p class="hero-subtitle">Repair shop workflow from intake to pickup.</p>
          <p class="hero-copy">A focused operations workspace for guitar and bass repair shops: customers, work orders, photos, damage maps, inventory, scheduling, email documents, and job history.</p>
          <div class="hero-actions">
            <a class="button primary" href="#application-modal" id="open-application">Request Beta Access</a>
            <a class="button secondary" href="${APP_URL}">Open App Login</a>
          </div>
          <p class="hero-note">Targeting a July 1, 2026 launch path with invite-only beta access, Shop and Pro tiers, and Stripe-powered account management planned for the paid release.</p>
        </div>

        <div class="product-frame" aria-label="FretTrack app preview">
          <div class="frame-bar">
            <span class="frame-dot"></span>
            <span class="frame-dot"></span>
            <span class="frame-dot"></span>
            <span class="frame-title">FretTrack shop workspace</span>
          </div>
          <img src="/landing/overview.jpg" alt="FretTrack repair shop job dashboard showing intake, job details, and current work orders.">
          <div class="hero-proof">
            <div class="proof-item">
              <strong>Bench workflow</strong>
              <span>Jobs, work logs, photos, and documents in one place.</span>
            </div>
            <div class="proof-item">
              <strong>Shop scoped</strong>
              <span>Auth, roles, and row-level access are part of the foundation.</span>
            </div>
            <div class="proof-item">
              <strong>Beta tested</strong>
              <span>Built from real repair-shop feedback, not generic ticketing.</span>
            </div>
          </div>
        </div>
      </header>
    </div>

    <main>
      <section class="section" id="product">
        <h2>Everything a repair counter needs before the instrument hits the case.</h2>
        <p class="section-lede">FretTrack keeps the customer story, instrument condition, repair plan, parts, scheduling, and pickup paperwork tied to the work order.</p>
        <div class="workflow">
          <div class="step">
            <span>01</span>
            <h3>Intake</h3>
            <p>Create the job, capture customer details, promise dates, source, priority, and instrument specifics.</p>
          </div>
          <div class="step">
            <span>02</span>
            <h3>Document</h3>
            <p>Use photos, damage maps, captions, and customer-ready reports to show condition clearly.</p>
          </div>
          <div class="step">
            <span>03</span>
            <h3>Repair</h3>
            <p>Track services, parts, work logs, payments, low-stock parts, scheduling, and status changes.</p>
          </div>
          <div class="step">
            <span>04</span>
            <h3>Pickup</h3>
            <p>Print or email clean work order and invoice documents with the right customer-facing details.</p>
          </div>
        </div>
      </section>

      <section class="dark-band">
        <div class="section feature-layout">
          <div>
            <h2>Purpose-built tools for the repair bench.</h2>
            <p class="section-lede">The product surface stays quiet and useful: dense enough for repeated shop work, visual enough for photos and damage documentation, and guarded enough for owner/admin/tech/viewer roles.</p>
            <div class="feature-list">
              <div class="feature">
                <h3>Photo documentation and editor</h3>
                <p>Save originals, make annotated copies, crop, brighten, caption, and clean backgrounds without AI cutout services.</p>
              </div>
              <div class="feature">
                <h3>Parts, inventory, and purchasing foundation</h3>
                <p>Inventory counts, movements, low stock, barcode identity, vendors, purchase orders, barcode labels, and receiving history are part of the 0.2.8 beta.</p>
              </div>
              <div class="feature">
                <h3>Scheduling and customer records</h3>
                <p>Keep appointments, due dates, pickups, customer history, and repeat-customer lookup connected to shop operations.</p>
              </div>
            </div>
          </div>
          <div class="media-stack">
            <div class="media-card">
              <img src="/landing/photo-editor.jpg" alt="FretTrack photo editor with markup, captions, crop, brightness, and manual background cleanup controls.">
              <div class="media-caption">Photo markup and manual background cleanup for real repair documentation.</div>
            </div>
            <div class="media-card">
              <img src="/landing/parts-and-billing.jpg" alt="FretTrack parts, services, billing, and totals view.">
              <div class="media-caption">Parts, services, payments, and customer-facing totals stay tied to the job.</div>
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="security">
        <h2>Built for real shop data, not throwaway demo records.</h2>
        <p class="section-lede">FretTrack is being prepared for paid customer use with invite-only access, verified accounts, shop-scoped data, role-aware UI, and explicit deployment checks before production changes.</p>
        <div class="trust-grid">
          <div class="trust-item">
            <strong>Auth and shop isolation</strong>
            <p>Supabase Auth, Row Level Security, membership roles, and guarded RPCs protect shop-scoped records.</p>
          </div>
          <div class="trust-item">
            <strong>Operator approval</strong>
            <p>Beta applications create auditable requests and notify operators before workspace access is granted.</p>
          </div>
          <div class="trust-item">
            <strong>Deployment discipline</strong>
            <p>Cloudflare, Supabase migrations, Worker functions, and documentation notes are tracked before release work moves forward.</p>
          </div>
        </div>
      </section>

      <section class="section" id="pricing">
        <h2>Trial, Shop, and Pro are the public product path.</h2>
        <p class="section-lede">Public Free is not the long-term product model. Unpaid access is a trial lifecycle. Shop covers the real repair workflow; Pro adds advanced reporting and future higher-end tools.</p>
        <div class="plan-grid">
          <div class="plan">
            <strong>Trial</strong>
            <h3>Evaluate FretTrack with approval</h3>
            <p>Invite-only beta access while the launch workflow is tightened.</p>
            <ul>
              <li>Approved tester login</li>
              <li>Real shop workflow testing</li>
              <li>Feedback-driven polish</li>
            </ul>
          </div>
          <div class="plan">
            <strong>Shop</strong>
            <h3>Core repair operations</h3>
            <p>The main tier for running a guitar repair shop day to day.</p>
            <ul>
              <li>Jobs, customers, photos, and work logs</li>
              <li>Inventory basics and scheduling</li>
              <li>Team members and photo editor</li>
            </ul>
          </div>
          <div class="plan">
            <strong>Pro</strong>
            <h3>Advanced operations</h3>
            <p>For shops that want deeper reporting and future automation.</p>
            <ul>
              <li>Advanced reporting</li>
              <li>Premium operational tools</li>
              <li>More integrations planned after launch</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="section" id="beta">
        <div class="launch-panel">
          <div>
            <h2>Shop owners wanted for beta testing.</h2>
            <p>Apply for invite-only access, then watch your email for the confirmation and approval messages. If you do not see a reply, check spam or junk mail; domain authentication is being tightened as launch approaches.</p>
          </div>
          <div class="hero-actions">
            <a class="button" href="#application-modal">Apply for Beta</a>
            <a class="button secondary" href="/beta-tester">Beta Tester Checklist</a>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <div class="footer-inner">
        <span>FretTrack Systems</span>
        <a class="footer-badge" href="https://devglobe.app/projects/frettrack?utm_source=badge&utm_medium=embed" target="_blank" rel="noopener">
          <img src="https://devglobe.app/badges/launched-on-devglobe-dark.svg" alt="Launched on DevGlobe" width="250" height="54">
        </a>
        <div class="footer-links">
          <a href="${APP_URL}">App Login</a>
          <a href="/beta-tester">Beta Tester Checklist</a>
          <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
        </div>
      </div>
    </footer>

    <div class="modal-backdrop" id="application-modal" role="presentation">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="application-title">
        <div class="modal-header">
          <div>
            <h2 id="application-title">Beta tester application</h2>
            <p>Tell us a little about your shop so beta access stays useful and controlled.</p>
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
          <p class="form-note">After submitting, check your inbox and spam or junk folder for FretTrack beta email.</p>
          <button class="button" type="submit">Submit Application</button>
          <p class="form-status" id="application-status" aria-live="polite"></p>
        </form>
      </div>
    </div>

    <script>
      const body = document.body;
      const openButtons = document.querySelectorAll('a[href="#application-modal"]');
      const closeButton = document.getElementById('close-application');
      const modal = document.getElementById('application-modal');
      const form = document.getElementById('application-form');
      const status = document.getElementById('application-status');

      function openModal() {
        body.classList.add('modal-open');
        status.textContent = '';
        status.className = 'form-status';
        const firstField = form.elements.name;
        if (firstField) firstField.focus();
      }

      function closeModal() {
        body.classList.remove('modal-open');
        if (window.location.hash === '#application-modal' && window.history && history.pushState) {
          history.pushState('', document.title, window.location.pathname + window.location.search);
        }
        const firstOpenButton = openButtons[0];
        if (firstOpenButton) firstOpenButton.focus();
      }

      openButtons.forEach((button) => {
        button.addEventListener('click', openModal);
      });
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        closeModal();
      });
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
        const payload = {};
        new FormData(form).forEach(function(value, key) {
          payload[key] = value;
        });

        submitButton.disabled = true;
        status.textContent = 'Submitting...';
        status.className = 'form-status';

        try {
          const response = await fetch('/api/beta-application', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const result = await parseApplicationResponse(response);
          if (!response.ok || !result.ok) {
            throw new Error(result.error || 'Unable to submit right now.');
          }
          form.reset();
          const delivery = result.emailDelivery || {};
          const applicantEmailStatus = delivery.applicant === 'sent'
            ? ' Confirmation email sent. If you do not see it, check your spam or junk folder.'
            : delivery.applicant === 'failed'
              ? ' Confirmation email failed; your application was still saved.'
              : '';
          status.textContent = result.warning
            ? result.message + applicantEmailStatus + ' ' + result.warning
            : (result.message || 'Application received. You will be contacted or approved before workspace access is enabled.') + applicantEmailStatus;
          status.className = 'form-status success';
        } catch (error) {
          status.textContent = error.message || 'Unable to submit right now.';
          status.className = 'form-status error';
        } finally {
          submitButton.disabled = false;
        }
      });

      async function parseApplicationResponse(response) {
        try {
          return await response.json();
        } catch (error) {
          return {
            ok: false,
            error: response.ok
              ? 'The application response was unreadable. Please contact support.'
              : 'The application service is temporarily unavailable. Please try again.'
          };
        }
      }
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

    if (isBundledAssetPath(url.pathname)) {
      return serveBundledAsset(request, env);
    }

    if (url.pathname === '/beta-tester') {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = '/beta-tester.html';
      return serveBundledAsset(new Request(assetUrl.toString(), request), env);
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
        'cache-control': 'no-store',
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
    const archiveResult = await archiveBetaApplication(application, env);

    const responseBody = {
      ok: true,
      message: `Application received for ${application.email}. Status: ${applicationResult?.status || 'pending'}.`,
      email: applicationResult?.email || application.email,
      status: applicationResult?.status || 'pending',
      requestedAt: applicationResult?.requestedAt || application.submittedAt,
      emailDelivery: emailResult.delivery
    };

    const warnings = [emailResult.warning, archiveResult.warning].filter(Boolean);
    if (warnings.length) {
      responseBody.warning = warnings.join(' ');
    }

    console.log('beta application saved', {
      applicantDomain: getEmailDomain(application.email),
      status: responseBody.status,
      emailWarning: Boolean(emailResult.warning),
      archiveWarning: Boolean(archiveResult.warning)
    });
    return jsonResponse(responseBody);
  } catch (error) {
    console.error('beta application save failed', {
      applicantDomain: getEmailDomain(application.email),
      error: error.message || 'Unknown beta application error.'
    });
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
  const notifyRecipients = parseEmailRecipients(env.BETA_APPLICATION_NOTIFY_TO || SUPPORT_EMAIL);

  if (!resendApiKey || !fromEmail || !notifyRecipients.length) {
    console.error('beta application email not configured', {
      hasResendApiKey: Boolean(resendApiKey),
      hasFromEmail: Boolean(fromEmail),
      hasNotifyRecipients: notifyRecipients.length > 0
    });
    return {
      warning: 'Application saved, but email delivery is not configured on the landing-page Worker yet.',
      delivery: {
        applicant: 'not_configured',
        operator: 'not_configured'
      }
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

  const applicantEmail = buildApplicantConfirmationEmail(application, details);

  const operatorText = [
    'New FretTrack beta application received.',
    '',
    details
  ].join('\n');

  const emailJobs = [
    {
      kind: 'applicant',
      to: application.email,
      subject: 'Thank you for signing up for the FretTrack Beta',
      text: applicantEmail.text,
      html: applicantEmail.html
    },
    ...notifyRecipients.map((recipient) => ({
      kind: 'operator',
      to: recipient,
      subject: `New FretTrack beta application: ${application.shopName || application.email}`,
      text: operatorText
    }))
  ];

  const results = await Promise.allSettled(emailJobs.map((emailJob) => (
    sendResendEmail({
      apiKey: resendApiKey,
      from: fromEmail,
      to: emailJob.to,
      subject: emailJob.subject,
      text: emailJob.text,
      html: emailJob.html || ''
    })
  )));

  const failures = results.reduce((accumulator, result, index) => {
    if (result.status === 'rejected' || result.value?.ok === false) {
      const emailJob = emailJobs[index];
      const message = result.reason?.message || result.value?.error || 'Email send failed.';
      console.error('beta application email failed', {
        kind: emailJob.kind,
        recipientDomain: getEmailDomain(emailJob.to),
        error: message
      });
      accumulator.push({ kind: emailJob.kind, message });
    }
    return accumulator;
  }, []);

  if (failures.length) {
    const operatorFailure = failures.find((failure) => failure.kind === 'operator');
    const applicantFailure = failures.find((failure) => failure.kind === 'applicant');
    const warning = operatorFailure
      ? 'Application saved, but the operator notification email failed. Check Worker and Resend logs.'
      : applicantFailure
        ? 'Application saved, but the applicant confirmation email failed. Check Worker and Resend logs.'
        : `Application saved, but email delivery had an issue: ${failures[0].message}`;
    return {
      warning,
      delivery: {
        applicant: applicantFailure ? 'failed' : 'sent',
        operator: operatorFailure ? 'failed' : 'sent'
      }
    };
  }

  console.log('beta application emails sent', {
    applicantConfirmationSent: true,
    operatorNotificationCount: notifyRecipients.length
  });
  return {
    warning: '',
    delivery: {
      applicant: 'sent',
      operator: 'sent'
    }
  };
}

function buildApplicantConfirmationEmail(application, details) {
  const safeName = escapeHtml(application.name || 'there');
  const safeShopName = escapeHtml(application.shopName || 'your shop');
  const safeEmail = escapeHtml(application.email);
  const safeSubmittedAt = escapeHtml(application.submittedAt);
  const safeDetails = escapeHtml(details);

  const text = [
    'Thank you for signing up for the FretTrack Beta!',
    '',
    `Hi ${application.name || 'there'},`,
    '',
    'We received your FretTrack beta access application and it is now waiting for operator review.',
    '',
    'You do not need to submit another application. If approved, you will receive a follow-up email with access instructions.',
    'If you do not see the confirmation or approval emails, please check your spam or junk folder.',
    '',
    'Application summary:',
    details,
    '',
    'FretTrack beta login:',
    APP_URL,
    '',
    'Thanks for your patience while we review beta access requests.',
    '',
    'Best regards,',
    'Jeffrey Russell',
    'FretTrack',
    'https://frettrack-app.com/'
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f1ea;color:#111827;font-family:Arial,sans-serif;line-height:1.5;">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
      <div style="background:#ffffff;border:1px solid #d9d1c2;border-radius:8px;padding:24px;">
        <h1 style="font-size:24px;line-height:1.2;margin:0 0 14px;">Thank you for signing up for the FretTrack Beta!</h1>
        <p style="margin:0 0 14px;">Hi ${safeName},</p>
        <p style="margin:0 0 14px;">We received your beta access application for <strong>${safeShopName}</strong>, and it is now waiting for operator review.</p>
        <p style="margin:0 0 14px;">You do not need to submit another application. If approved, you will receive a follow-up email with access instructions.</p>
        <p style="margin:0 0 14px;"><strong>Please check your spam or junk folder</strong> if you do not see FretTrack beta emails in your inbox.</p>
        <p style="margin:0 0 14px;"><a href="${APP_URL}" style="color:#9a4d14;font-weight:700;">FretTrack beta login</a></p>
        <h2 style="font-size:16px;margin:22px 0 8px;">Application summary</h2>
        <pre style="white-space:pre-wrap;background:#f8f6f1;border:1px solid #d9d1c2;border-radius:6px;color:#374151;font-family:Arial,sans-serif;font-size:14px;margin:0 0 18px;padding:12px;">${safeDetails}</pre>
        <p style="color:#4b5563;font-size:13px;margin:0 0 18px;">Submitted as ${safeEmail} on ${safeSubmittedAt}.</p>
        <p style="margin:0;">Best regards,<br>Jeffrey Russell<br>FretTrack<br><a href="https://frettrack-app.com/" style="color:#9a4d14;">frettrack-app.com</a></p>
      </div>
    </div>
  </body>
</html>`;

  return { text, html };
}

async function sendResendEmail({ apiKey, from, to, subject, text, html }) {
  const body = { from, to, subject, text };
  if (html) {
    body.html = html;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || 'Resend send failed.');
  }

  return { ok: true, id: result.id || '' };
}

async function archiveBetaApplication(application, env) {
  if (!env.FRETTRACK_APP_ASSETS) {
    return { warning: '' };
  }

  try {
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
    return { warning: '' };
  } catch (error) {
    console.error('beta application archive failed', {
      applicantDomain: getEmailDomain(application.email),
      error: error.message || 'Unknown archive error.'
    });
    return {
      warning: 'Application saved, but the backup archive step failed. Check Worker logs.'
    };
  }
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

function isBundledAssetPath(pathname) {
  return BUNDLED_ASSET_PATHS.has(pathname) || pathname.startsWith('/landing/');
}

async function serveBundledAsset(request, env) {
  if (!env.LANDING_ASSETS) {
    return new Response('Asset service not configured', {
      status: 404,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }

  const response = await env.LANDING_ASSETS.fetch(request);
  if (response.status === 404) {
    return new Response('Asset not found', {
      status: 404,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }

  const headers = new Headers(response.headers);
  const pathname = new URL(request.url).pathname;
  const longLivedAsset = /\.(ico|png|jpe?g|webp)$/i.test(pathname);
  headers.set('cache-control', longLivedAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  headers.set('x-content-type-options', 'nosniff');

  return new Response(response.body, {
    status: response.status,
    headers
  });
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseEmailRecipients(value) {
  return String(value || '')
    .split(/[,\s;]+/)
    .map((recipient) => String(recipient || '').trim().toLowerCase().slice(0, 180))
    .filter((recipient, index, recipients) => (
      recipient
      && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)
      && recipients.indexOf(recipient) === index
    ));
}

function getEmailDomain(value) {
  const [, domain = 'unknown'] = String(value || '').split('@');
  return domain || 'unknown';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
