const APP_URL = 'https://app.frettrack-app.com';
const SUPPORT_EMAIL = 'support@frettrack-app.com';
const BANNER_URL = '/assets/frettrack-banner.png';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://devglobe.app https://api.producthunt.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https://*.supabase.co",
  "manifest-src 'self'"
].join('; ');
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=()';
const BUNDLED_ASSET_PATHS = new Set([
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/site.webmanifest',
  '/docs.html',
  '/docs/release-notes.html',
  '/privacy.html',
  '/support.html',
  '/terms.html'
]);
const STATIC_PAGE_ROUTES = new Map([
  ['/beta-tester', '/docs/release-notes.html'],
  ['/testing-checklist', '/docs/release-notes.html'],
  ['/release-notes', '/docs/release-notes.html'],
  ['/docs', '/docs.html'],
  ['/docs/', '/docs.html'],
  ['/docs/how-to-use-frettrack', '/docs/how-to-use-frettrack.html'],
  ['/docs/getting-started', '/docs/getting-started.html'],
  ['/docs/beta-tester-guide', '/docs/release-notes.html'],
  ['/docs/workflow-testing', '/docs/release-notes.html'],
  ['/docs/release-notes', '/docs/release-notes.html'],
  ['/docs/shops-and-accounts', '/docs/shops-and-accounts.html'],
  ['/docs/customers', '/docs/customers.html'],
  ['/docs/jobs', '/docs/jobs.html'],
  ['/docs/estimates', '/docs/estimates.html'],
  ['/docs/photos-and-damage-maps', '/docs/photos-and-damage-maps.html'],
  ['/docs/inventory-and-parts', '/docs/inventory-and-parts.html'],
  ['/docs/shipping-and-custody', '/docs/shipping-and-custody.html'],
  ['/docs/scheduling', '/docs/scheduling.html'],
  ['/docs/reports', '/docs/reports.html'],
  ['/docs/billing-and-subscriptions', '/docs/billing-and-subscriptions.html'],
  ['/docs/roles-and-permissions', '/docs/roles-and-permissions.html'],
  ['/docs/troubleshooting', '/docs/troubleshooting.html'],
  ['/docs/faq', '/docs/faq.html'],
  ['/privacy', '/privacy.html'],
  ['/support', '/support.html'],
  ['/terms', '/terms.html']
]);

function landingPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FretTrack | Instrument Repair Shop Workflow</title>
    <meta name="description" content="FretTrack is professional workflow software for guitar, amplifier, and keyboard repair shops: intake, bench work, photos, inventory, scheduling, customer communication, billing, and records.">
    <link rel="canonical" href="https://frettrack-app.com/">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#0b1118">
    <meta property="og:title" content="FretTrack | Instrument Repair Shop Workflow">
    <meta property="og:description" content="Run guitar, amplifier, and keyboard repair work from intake through pickup in one focused shop workspace.">
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

      .community-band {
        background:
          radial-gradient(circle at 88% 16%, rgba(88, 101, 242, 0.32), transparent 34%),
          radial-gradient(circle at 12% 92%, rgba(255, 69, 0, 0.16), transparent 30%),
          #0b1118;
        color: #ffffff;
        overflow: hidden;
      }

      .community-band .section-lede {
        color: #bac5d3;
      }

      .community-kicker {
        color: #8ea1ff;
        display: block;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0.14em;
        margin-bottom: 14px;
        text-transform: uppercase;
      }

      .discord-spotlight {
        background:
          linear-gradient(125deg, rgba(88, 101, 242, 0.98), rgba(50, 63, 181, 0.96));
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 22px;
        box-shadow: 0 28px 70px rgba(0, 0, 0, 0.34);
        color: #ffffff;
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
        margin-top: 34px;
        min-height: 420px;
        overflow: hidden;
        text-decoration: none;
        transition: box-shadow 180ms ease, transform 180ms ease;
      }

      .discord-spotlight:hover,
      .discord-spotlight:focus-visible {
        box-shadow: 0 34px 90px rgba(88, 101, 242, 0.38);
        outline: 3px solid #ffffff;
        outline-offset: 4px;
        transform: translateY(-3px);
      }

      .discord-copy {
        align-self: center;
        padding: clamp(30px, 5vw, 58px);
        position: relative;
        z-index: 2;
      }

      .discord-label {
        align-items: center;
        display: inline-flex;
        font-size: 13px;
        font-weight: 900;
        gap: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .discord-label::before {
        background: #77f0d2;
        border-radius: 999px;
        box-shadow: 0 0 0 5px rgba(119, 240, 210, 0.14);
        content: "";
        height: 9px;
        width: 9px;
      }

      .discord-copy h3 {
        font-size: clamp(36px, 5.4vw, 68px);
        letter-spacing: -0.045em;
        line-height: 0.94;
        margin: 22px 0 18px;
        max-width: 700px;
        text-wrap: balance;
      }

      .discord-copy p {
        color: #eef0ff;
        font-size: clamp(16px, 1.8vw, 20px);
        margin: 0;
        max-width: 650px;
      }

      .discord-cta {
        align-items: center;
        background: #ffffff;
        border-radius: 999px;
        color: #303a9f;
        display: inline-flex;
        font-size: 16px;
        font-weight: 900;
        gap: 10px;
        margin-top: 28px;
        min-height: 52px;
        padding: 13px 22px;
      }

      .discord-visual {
        min-height: 420px;
        overflow: hidden;
        position: relative;
      }

      .discord-server-shot {
        height: 100%;
        inset: 0;
        object-fit: cover;
        object-position: 36% center;
        opacity: 0.46;
        position: absolute;
        width: 100%;
      }

      .discord-visual::after {
        background: linear-gradient(90deg, #4653cf 0%, transparent 56%);
        content: "";
        inset: 0;
        position: absolute;
      }

      .discord-emblem {
        border: 2px solid rgba(255, 255, 255, 0.76);
        border-radius: 28px;
        bottom: 34px;
        box-shadow: 0 22px 50px rgba(0, 0, 0, 0.48);
        height: clamp(150px, 19vw, 225px);
        object-fit: cover;
        position: absolute;
        right: clamp(26px, 5vw, 58px);
        transform: rotate(3deg);
        width: clamp(150px, 19vw, 225px);
        z-index: 1;
      }

      .community-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 18px;
      }

      .community-card {
        background: rgba(20, 29, 41, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 14px;
        color: #ffffff;
        display: flex;
        flex-direction: column;
        min-height: 275px;
        overflow: hidden;
        padding: 26px;
        text-decoration: none;
        transition: border-color 160ms ease, transform 160ms ease;
      }

      .community-card:hover,
      .community-card:focus-visible {
        border-color: rgba(255, 255, 255, 0.55);
        outline: 2px solid transparent;
        transform: translateY(-3px);
      }

      .community-card.reddit-card {
        background:
          linear-gradient(135deg, rgba(255, 69, 0, 0.13), transparent 60%),
          rgba(20, 29, 41, 0.96);
      }

      .community-card-art {
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 18px;
        height: 92px;
        margin-bottom: 24px;
        object-fit: cover;
        width: 92px;
      }

      .community-card h3 {
        font-size: 24px;
        line-height: 1.06;
        margin: 0 0 10px;
      }

      .community-card p {
        color: #b9c5d3;
        margin: 0;
      }

      .community-card-action {
        color: #ffffff;
        font-size: 14px;
        font-weight: 900;
        margin-top: auto;
        padding-top: 24px;
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

      .footer-badges {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
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

      .public-system-status {
        background: #101925;
        border-block: 1px solid var(--line);
        color: var(--ink);
      }

      .public-system-status-inner {
        align-items: center;
        display: grid;
        gap: 12px 22px;
        grid-template-columns: auto minmax(0, 1fr) auto;
        margin: 0 auto;
        padding: 14px 0;
        width: min(1180px, calc(100% - 40px));
      }

      .public-system-status[data-status="maintenance"],
      .public-system-status[data-status="degraded"] {
        background: #352714;
        border-color: var(--amber);
      }

      .public-system-status[data-status="outage"] {
        background: #3b171b;
        border-color: var(--danger);
      }

      .public-system-status-label {
        font-size: 13px;
        font-weight: 850;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .public-system-status-copy strong,
      .public-system-status-copy span {
        display: block;
      }

      .public-system-status-copy span,
      .public-system-status-meta {
        color: var(--muted);
        font-size: 13px;
      }

      .public-system-status-meta {
        text-align: right;
      }

      @media (max-width: 980px) {
        .hero,
        .feature-layout,
        .launch-panel,
        .discord-spotlight {
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
        .workflow,
        .community-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .launch-panel {
          align-items: start;
        }

        .discord-visual {
          min-height: 330px;
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
        .workflow,
        .community-grid {
          grid-template-columns: 1fr;
        }

        .discord-spotlight {
          border-radius: 14px;
        }

        .discord-copy h3 {
          font-size: clamp(34px, 12vw, 52px);
        }

        .discord-visual {
          min-height: 270px;
        }

        .discord-emblem {
          bottom: 22px;
          right: 22px;
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

        .public-system-status-inner {
          grid-template-columns: 1fr;
          width: min(100% - 28px, 1180px);
        }

        .public-system-status-meta {
          text-align: left;
        }
      }
    </style>
  </head>
  <body>
    <div class="site-shell">
      <nav class="nav" aria-label="Main navigation">
        <a class="brand" href="/" aria-label="FretTrack home">
          <img src="/android-chrome-192x192.png" alt="">
          <span class="brand-text"><strong>FretTrack</strong><span>Modern workflow for instrument repair</span></span>
        </a>
        <div class="nav-links">
          <a href="#product">Product</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
          <a href="#access">Access</a>
          <a href="#community">Community</a>
          <a href="/docs">Docs</a>
          <a href="/support">Support</a>
          <a href="/terms">Terms</a>
          <a href="/docs/release-notes">Release Notes</a>
          <a class="login" href="${APP_URL}">Login</a>
        </div>
      </nav>

      <header class="hero">
        <div>
          <h1>FretTrack</h1>
          <p class="hero-subtitle">Repair shop workflow from intake to pickup.</p>
          <p class="hero-copy">A focused operations workspace for guitar, bass, amplifier, and keyboard repair shops: customers, work orders, specialist bench records, inventory, scheduling, customer communication, billing, and job history.</p>
          <div class="hero-actions">
            <a class="button primary" href="#application-modal" id="open-application">Request Access</a>
            <a class="button secondary" href="${APP_URL}">Open App Login</a>
          </div>
          <p class="hero-note">Stable release 0.3.0 is available. Controlled workspace access is open, and Shop and Pro subscriptions use secure Stripe Checkout and self-service billing management.</p>
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
              <strong>Shop tested</strong>
              <span>Built from real repair-shop feedback, not generic ticketing.</span>
            </div>
          </div>
        </div>
      </header>
    </div>

    <aside class="public-system-status" id="public-system-status" data-status="unknown" aria-live="polite">
      <div class="public-system-status-inner">
        <span class="public-system-status-label" id="public-system-status-label">System status</span>
        <div class="public-system-status-copy">
          <strong id="public-system-status-title">Checking FretTrack service status...</strong>
          <span id="public-system-status-message">Status details will appear here when available.</span>
        </div>
        <div class="public-system-status-meta">
          <span id="public-system-status-duration">Status unavailable</span><br>
          <span id="public-system-status-updated"></span>
        </div>
      </div>
    </aside>

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
            <p>Use focused Guitar, Amplifier, and Keyboard benches while tracking services, parts, work logs, payments, scheduling, and status changes.</p>
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
                <p>Inventory counts, movements, low stock, barcode identity, vendors, purchase orders, barcode labels, and receiving history are part of FretTrack.</p>
              </div>
              <div class="feature">
                <h3>Scheduling and customer records</h3>
                <p>Keep appointments, due dates, pickups, customer history, and repeat-customer lookup connected to shop operations.</p>
              </div>
              <div class="feature">
                <h3>Customer communication and retention</h3>
                <p>Send immediate or scheduled email, configure opted-in service reminders, and manage Pro loyalty stamps without leaving the work order.</p>
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
        <p class="section-lede">FretTrack is built for paid business use with controlled access, verified accounts, shop-scoped data, role-aware UI, and explicit deployment checks before production changes.</p>
        <div class="trust-grid">
          <div class="trust-item">
            <strong>Auth and shop isolation</strong>
            <p>Supabase Auth, Row Level Security, membership roles, and guarded RPCs protect shop-scoped records.</p>
          </div>
          <div class="trust-item">
            <strong>Operator approval</strong>
            <p>Access applications create auditable requests and notify operators before workspace access is granted.</p>
          </div>
          <div class="trust-item">
            <strong>Deployment discipline</strong>
            <p>Cloudflare, Supabase migrations, Worker functions, and documentation notes are tracked before release work moves forward.</p>
          </div>
        </div>
      </section>

      <section class="section" id="pricing">
        <h2>Start with Pro, then choose the plan that fits the shop.</h2>
        <p class="section-lede">Every approved shop receives a 14-day Pro trial with no card required and no automatic conversion. Paid subscriptions are for business use and renew until canceled.</p>
        <div class="plan-grid">
          <div class="plan">
            <strong>Trial</strong>
            <h3>14 days · $0</h3>
            <p>Evaluate the complete Pro workflow after account approval.</p>
            <ul>
              <li>No card required</li>
              <li>Does not automatically convert</li>
              <li>Existing data remains available if the trial expires</li>
            </ul>
          </div>
          <div class="plan">
            <strong>Shop</strong>
            <h3>$29.99 monthly</h3>
            <p>$299.99 yearly · save $59.89 compared with twelve monthly payments.</p>
            <ul>
              <li>Jobs, customers, photos, and work logs</li>
              <li>Inventory, purchasing, scheduling, and billing</li>
              <li>Single-user core repair-shop operation</li>
            </ul>
          </div>
          <div class="plan">
            <strong>Pro</strong>
            <h3>$39.99 monthly</h3>
            <p>$399.99 yearly · save $79.89 compared with twelve monthly payments.</p>
            <ul>
              <li>Everything in Shop</li>
              <li>Team Members, Photo Editor, and Advanced Reporting</li>
              <li>Amplifier Repair, Keyboard Repair, Scheduled Email, service reminders, and Loyalty</li>
            </ul>
          </div>
        </div>
        <p class="section-lede">Cancel anytime through the Stripe Billing Portal; access continues through the current paid period. The first annual subscription purchase has a 14-day refund window. Monthly payments and renewals are non-refundable except for billing errors or when required by law. Prices are USD; applicable taxes, if any, are shown at Checkout.</p>
      </section>

      <section class="section" id="access">
        <div class="launch-panel">
          <div>
            <h2>Bring your repair shop to FretTrack.</h2>
            <p>Request controlled workspace access, then watch your email for confirmation and approval messages. If you do not see a reply, check spam or junk mail.</p>
          </div>
          <div class="hero-actions">
            <a class="button" href="#application-modal">Request Access</a>
            <a class="button secondary" href="/docs/release-notes">Read the 0.3.0 Release Notes</a>
          </div>
        </div>
      </section>

      <section class="community-band" id="community">
        <div class="section">
          <span class="community-kicker">Follow the build</span>
          <h2>News, shop talk, and the work behind FretTrack.</h2>
          <p class="section-lede">Get release news, help shape FretTrack, follow development, and connect with the repair-shop community.</p>

          <a class="discord-spotlight" href="https://discord.gg/3ppvjkYwYR" target="_blank" rel="noopener">
            <div class="discord-copy">
              <span class="discord-label">FretTrack community</span>
              <h3>Join our Discord for news and updates!</h3>
              <p>Get product announcements, release notes, feature previews, support, and honest shop-floor conversation directly from the people building and using FretTrack.</p>
              <span class="discord-cta">Join the FretTrack Discord <span aria-hidden="true">→</span></span>
            </div>
            <div class="discord-visual" aria-hidden="true">
              <img class="discord-server-shot" src="/community/frettrack-discord.jpg" alt="" loading="lazy">
              <img class="discord-emblem" src="/community/discord-frettrack.png" alt="" loading="lazy">
            </div>
          </a>

          <div class="community-grid">
            <a class="community-card reddit-card" href="https://www.reddit.com/r/FretTrack/" target="_blank" rel="noopener">
              <img class="community-card-art" src="/community/reddit-frettrack.png" alt="" loading="lazy">
              <h3>Join r/FretTrack</h3>
              <p>Share workflow ideas, feature requests, repair-shop lessons, and feedback with the growing FretTrack community.</p>
              <span class="community-card-action">Visit the subreddit <span aria-hidden="true">→</span></span>
            </a>
            <a class="community-card" href="https://github.com/Jride-Dev/FretTrack" target="_blank" rel="noopener">
              <img class="community-card-art" src="/community/github-frettrack.png" alt="" loading="lazy">
              <h3>Follow development</h3>
              <p>Explore the public repository, track releases, review the roadmap, and see how FretTrack is built.</p>
              <span class="community-card-action">View FretTrack on GitHub <span aria-hidden="true">→</span></span>
            </a>
            <a class="community-card" href="https://torranceguitarrepair.com/" target="_blank" rel="noopener">
              <img class="community-card-art" src="/community/torrance-guitar-repair.png" alt="JR's Custom Shop, Torrance Guitar Setup and Repair logo" loading="lazy">
              <h3>Built in a real repair shop</h3>
              <p>Meet Torrance Guitar Repair, the working shop where FretTrack’s tools and workflows are put to the test.</p>
              <span class="community-card-action">Visit Torrance Guitar Repair <span aria-hidden="true">→</span></span>
            </a>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <div class="footer-inner">
        <span>FretTrack · operated by Jeffrey Russell d/b/a Torrance Guitar Repair</span>
        <div class="footer-badges">
          <a class="footer-badge" href="https://devglobe.app/projects/frettrack?utm_source=badge&utm_medium=embed" target="_blank" rel="noopener">
            <img src="https://devglobe.app/badges/launched-on-devglobe-dark.svg" alt="Launched on DevGlobe" width="250" height="54">
          </a>
          <a class="footer-badge" href="https://www.producthunt.com/products/frettrack/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-frettrack" target="_blank" rel="noopener noreferrer">
            <img src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1257938&theme=light" alt="Review FretTrack on Product Hunt" width="250" height="54" loading="lazy">
          </a>
        </div>
        <div class="footer-links">
          <a href="${APP_URL}">App Login</a>
          <a href="/docs">Docs</a>
          <a href="https://discord.gg/3ppvjkYwYR" target="_blank" rel="noopener">Discord</a>
          <a href="https://github.com/Jride-Dev/FretTrack" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.reddit.com/r/FretTrack/" target="_blank" rel="noopener">Reddit</a>
          <a href="https://torranceguitarrepair.com/" target="_blank" rel="noopener">Torrance Guitar Repair</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
          <a href="/privacy">Privacy</a>
          <a href="/docs/release-notes">Release Notes</a>
          <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
        </div>
      </div>
    </footer>

    <div class="modal-backdrop" id="application-modal" role="presentation">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="application-title">
        <div class="modal-header">
          <div>
            <h2 id="application-title">FretTrack access application</h2>
            <p>Tell us a little about your shop so onboarding stays useful and controlled.</p>
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
          <p class="form-note">After submitting, check your inbox and spam or junk folder for FretTrack email.</p>
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
      const publicStatus = document.getElementById('public-system-status');
      const publicStatusLabel = document.getElementById('public-system-status-label');
      const publicStatusTitle = document.getElementById('public-system-status-title');
      const publicStatusMessage = document.getElementById('public-system-status-message');
      const publicStatusDuration = document.getElementById('public-system-status-duration');
      const publicStatusUpdated = document.getElementById('public-system-status-updated');
      let publicStatusSnapshot = null;

      function formatStatusDuration(snapshot) {
        const changedAt = Date.parse(snapshot.statusChangedAt || '');
        if (!Number.isFinite(changedAt)) return snapshot.incidentState ? 'Incident duration unavailable' : 'Uptime unavailable';
        const totalMinutes = Math.max(0, Math.floor((Date.now() - changedAt) / 60000));
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;
        const parts = [];
        if (days) parts.push(days + 'd');
        if (hours || days) parts.push(hours + 'h');
        parts.push(minutes + 'm');
        return (snapshot.incidentState ? 'Incident duration ' : 'Uptime ') + parts.join(' ');
      }

      function renderPublicSystemStatus(snapshot) {
        publicStatusSnapshot = snapshot;
        publicStatus.dataset.status = snapshot.status;
        publicStatusLabel.textContent = snapshot.statusLabel || snapshot.status;
        publicStatusTitle.textContent = snapshot.publicNoticeTitle;
        publicStatusMessage.textContent = snapshot.publicNoticeMessage;
        publicStatusDuration.textContent = formatStatusDuration(snapshot);
        publicStatusUpdated.textContent = snapshot.lastUpdatedAt
          ? 'Updated ' + new Date(snapshot.lastUpdatedAt).toLocaleString()
          : 'Update time unavailable';
      }

      async function loadPublicSystemStatus() {
        try {
          const response = await fetch('/api/system-status', { headers: { accept: 'application/json' } });
          if (!response.ok) throw new Error('Status request unavailable.');
          renderPublicSystemStatus(await response.json());
        } catch {
          publicStatus.dataset.status = 'unknown';
          publicStatusLabel.textContent = 'Status unavailable';
          publicStatusTitle.textContent = 'FretTrack status could not be loaded';
          publicStatusMessage.textContent = 'Please try again shortly or contact support if you need help.';
          publicStatusDuration.textContent = 'Status unavailable';
          publicStatusUpdated.textContent = '';
        }
      }

      loadPublicSystemStatus();
      window.setInterval(function() {
        if (publicStatusSnapshot) publicStatusDuration.textContent = formatStatusDuration(publicStatusSnapshot);
      }, 60000);

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
          const response = await fetch('/api/access-application', {
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

    const staticPagePath = STATIC_PAGE_ROUTES.get(url.pathname);
    if (staticPagePath) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = staticPagePath;
      return serveBundledAsset(new Request(assetUrl.toString(), request), env);
    }

    if (url.pathname.startsWith('/assets/')) {
      return serveAsset(url.pathname, env);
    }

    if (url.pathname === '/api/access-application' || url.pathname === '/api/beta-application') {
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
      }
      return saveAccessApplication(request, env);
    }

    if (url.pathname === '/api/system-status') {
      if (request.method !== 'GET') {
        return jsonResponse({ error: 'Method not allowed.' }, 405);
      }
      return getPublicSystemStatus(env);
    }

    if (url.pathname === '/app') {
      return Response.redirect(APP_URL, 302);
    }

    return new Response(landingPage(), {
      headers: htmlHeaders({
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      })
    });
  }
};

async function getPublicSystemStatus(env) {
  const supabaseUrl = cleanText(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '', 300).replace(/\/+$/, '');
  const supabaseAnonKey = cleanText(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '', 1000);
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'System status is unavailable.' }, 503);
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_system_status`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
        'content-type': 'application/json'
      },
      body: '{}'
    });
    if (!response.ok) {
      throw new Error(`Status provider returned ${response.status}.`);
    }
    const status = await response.json();
    return jsonResponse({
      status: cleanText(status.status, 20),
      statusLabel: getPublicStatusLabel(status.status),
      publicNoticeTitle: cleanText(status.publicNoticeTitle, 160),
      publicNoticeMessage: cleanText(status.publicNoticeMessage, 1200),
      statusChangedAt: cleanText(status.statusChangedAt, 80),
      lastUpdatedAt: cleanText(status.lastUpdatedAt, 80),
      incidentState: Boolean(status.incidentState)
    });
  } catch (error) {
    console.error('public system status load failed', { error: error.message || 'Unknown error.' });
    return jsonResponse({ error: 'System status is unavailable.' }, 503);
  }
}

function getPublicStatusLabel(status) {
  return {
    operational: 'Operational',
    maintenance: 'Maintenance',
    degraded: 'Degraded',
    outage: 'Outage'
  }[status] || 'Status unavailable';
}

async function saveAccessApplication(request, env) {
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
    const applicationFingerprint = await createAccessApplicationFingerprint(application);
    const applicationResult = await submitAccessRequest(application, env);
    const sideEffectKey = getAccessApplicationSideEffectKey(applicationResult, applicationFingerprint);
    const emailResult = await sendAccessApplicationEmails(application, env, sideEffectKey);
    const archiveResult = await archiveAccessApplication(application, env, sideEffectKey);

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

    console.log('access application saved', {
      applicantDomain: getEmailDomain(application.email),
      status: responseBody.status,
      emailWarning: Boolean(emailResult.warning),
      archiveWarning: Boolean(archiveResult.warning)
    });
    return jsonResponse(responseBody);
  } catch (error) {
    console.error('access application save failed', {
      applicantDomain: getEmailDomain(application.email),
      error: error.message || 'Unknown access application error.'
    });
    return jsonResponse({ ok: false, error: error.message || 'Unable to submit right now.' }, 500);
  }
}

async function submitAccessRequest(application, env) {
  const supabaseUrl = cleanText(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '', 300).replace(/\/+$/, '');
  const supabaseAnonKey = cleanText(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '', 1000);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Access application service is not configured.');
  }

  const notes = [
    `State: ${application.state}`,
    `Team size: ${application.teamSize}`,
    `Current tracking: ${application.currentTracking}`,
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

async function sendAccessApplicationEmails(application, env, sideEffectKey) {
  const resendApiKey = cleanText(env.RESEND_API_KEY || '', 300);
  const fromEmail = cleanText(env.SHOP_EMAIL_FROM || '', 180) || 'FretTrack <noreply@frettrack-app.com>';
  const notifyRecipients = parseEmailRecipients(env.ACCESS_APPLICATION_NOTIFY_TO || env.BETA_APPLICATION_NOTIFY_TO || SUPPORT_EMAIL);

  if (!resendApiKey || !fromEmail || !notifyRecipients.length) {
    console.error('access application email not configured', {
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
    `Current Tracking: ${application.currentTracking}`
  ].filter(Boolean).join('\n');

  const applicantEmail = buildApplicantConfirmationEmail(application, details);

  const operatorText = [
    'New FretTrack access application received.',
    '',
    details
  ].join('\n');

  const operatorJobs = await Promise.all(notifyRecipients.map(async (recipient) => ({
    kind: 'operator',
    to: recipient,
    subject: `New FretTrack access application: ${application.shopName || application.email}`,
    text: operatorText,
    idempotencyKey: `frettrack-access/${sideEffectKey}/operator/${await sha256Hex(recipient.toLowerCase())}`
  })));

  const emailJobs = [
    {
      kind: 'applicant',
      to: application.email,
      subject: 'Thank you for requesting FretTrack access',
      text: applicantEmail.text,
      html: applicantEmail.html,
      idempotencyKey: `frettrack-access/${sideEffectKey}/applicant`
    },
    ...operatorJobs
  ];

  const results = await Promise.allSettled(emailJobs.map((emailJob) => (
    sendResendEmail({
      apiKey: resendApiKey,
      from: fromEmail,
      to: emailJob.to,
      subject: emailJob.subject,
      text: emailJob.text,
      html: emailJob.html || '',
      idempotencyKey: emailJob.idempotencyKey
    })
  )));

  const failures = results.reduce((accumulator, result, index) => {
    if (result.status === 'rejected' || result.value?.ok === false) {
      const emailJob = emailJobs[index];
      const message = result.reason?.message || result.value?.error || 'Email send failed.';
      console.error('access application email failed', {
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

  console.log('access application emails sent', {
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
  const safeDetails = escapeHtml(details);

  const text = [
    'Thank you for requesting FretTrack access!',
    '',
    `Hi ${application.name || 'there'},`,
    '',
    'We received your FretTrack access application and it is now waiting for operator review.',
    '',
    'You do not need to submit another application. If approved, you will receive a follow-up email with access instructions.',
    'If you do not see the confirmation or approval emails, please check your spam or junk folder.',
    '',
    'Application summary:',
    details,
    '',
    'FretTrack login:',
    APP_URL,
    '',
    'Thanks for your patience while we review access requests.',
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
        <h1 style="font-size:24px;line-height:1.2;margin:0 0 14px;">Thank you for requesting FretTrack access!</h1>
        <p style="margin:0 0 14px;">Hi ${safeName},</p>
        <p style="margin:0 0 14px;">We received your access application for <strong>${safeShopName}</strong>, and it is now waiting for operator review.</p>
        <p style="margin:0 0 14px;">You do not need to submit another application. If approved, you will receive a follow-up email with access instructions.</p>
        <p style="margin:0 0 14px;"><strong>Please check your spam or junk folder</strong> if you do not see FretTrack emails in your inbox.</p>
        <p style="margin:0 0 14px;"><a href="${APP_URL}" style="color:#9a4d14;font-weight:700;">FretTrack login</a></p>
        <h2 style="font-size:16px;margin:22px 0 8px;">Application summary</h2>
        <pre style="white-space:pre-wrap;background:#f8f6f1;border:1px solid #d9d1c2;border-radius:6px;color:#374151;font-family:Arial,sans-serif;font-size:14px;margin:0 0 18px;padding:12px;">${safeDetails}</pre>
        <p style="color:#4b5563;font-size:13px;margin:0 0 18px;">Submitted as ${safeEmail}.</p>
        <p style="margin:0;">Best regards,<br>Jeffrey Russell<br>FretTrack<br><a href="https://frettrack-app.com/" style="color:#9a4d14;">frettrack-app.com</a></p>
      </div>
    </div>
  </body>
</html>`;

  return { text, html };
}

async function sendResendEmail({ apiKey, from, to, subject, text, html, idempotencyKey }) {
  const body = { from, to, subject, text };
  if (html) {
    body.html = html;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(body)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || 'Resend send failed.');
  }

  return { ok: true, id: result.id || '' };
}

async function archiveAccessApplication(application, env, sideEffectKey) {
  if (!env.FRETTRACK_APP_ASSETS) {
    return { warning: '' };
  }

  try {
    const key = `access-applications/by-request/${sideEffectKey}.json`;
    if (typeof env.FRETTRACK_APP_ASSETS.head === 'function') {
      const existing = await env.FRETTRACK_APP_ASSETS.head(key);
      if (existing) {
        return { warning: '' };
      }
    }
    await env.FRETTRACK_APP_ASSETS.put(
      key,
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
    console.error('access application archive failed', {
      applicantDomain: getEmailDomain(application.email),
      error: error.message || 'Unknown archive error.'
    });
    return {
      warning: 'Application saved, but the backup archive step failed. Check Worker logs.'
    };
  }
}

async function createAccessApplicationFingerprint(application) {
  return sha256Hex(JSON.stringify({
    email: application.email,
    name: application.name,
    state: application.state,
    shopName: application.shopName,
    teamSize: application.teamSize,
    currentTracking: application.currentTracking
  }));
}

function getAccessApplicationSideEffectKey(applicationResult, fallbackFingerprint) {
  const requestId = cleanText(applicationResult?.requestId || '', 80);
  return /^[0-9a-f-]{32,80}$/i.test(requestId) ? requestId : fallbackFingerprint;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function serveAsset(pathname, env) {
  const key = `site/${pathname.replace('/assets/', '')}`;
  const object = await env.FRETTRACK_APP_ASSETS.get(key);

  if (!object) {
    return new Response('Asset not found', {
      status: 404,
      headers: baselineHeaders({ 'cache-control': 'no-store' })
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', object.httpMetadata?.cacheControl || 'public, max-age=300');
  addBaselineSecurityHeaders(headers);

  return new Response(object.body, { headers });
}

function isBundledAssetPath(pathname) {
  return BUNDLED_ASSET_PATHS.has(pathname)
    || pathname.startsWith('/landing/')
    || pathname.startsWith('/community/')
    || (pathname.startsWith('/docs/') && /\.[a-z0-9]+$/i.test(pathname));
}

async function serveBundledAsset(request, env) {
  if (!env.LANDING_ASSETS) {
    return new Response('Asset service not configured', {
      status: 404,
      headers: baselineHeaders({
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      })
    });
  }

  const response = await env.LANDING_ASSETS.fetch(request);
  if (response.status === 404) {
    return new Response('Asset not found', {
      status: 404,
      headers: baselineHeaders({
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      })
    });
  }

  const headers = new Headers(response.headers);
  const pathname = new URL(request.url).pathname;
  const longLivedAsset = /\.(ico|png|jpe?g|webp)$/i.test(pathname);
  const contentType = headers.get('content-type') || '';
  const isHtml = contentType.includes('text/html') || pathname.endsWith('.html');
  headers.set('cache-control', isHtml
    ? 'no-store'
    : longLivedAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  addBaselineSecurityHeaders(headers);
  if (isHtml) {
    addHtmlSecurityHeaders(headers);
  }

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
    headers: baselineHeaders({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    })
  });
}

function htmlHeaders(init = {}) {
  const headers = baselineHeaders(init);
  addHtmlSecurityHeaders(headers);
  return headers;
}

function baselineHeaders(init = {}) {
  const headers = new Headers(init);
  addBaselineSecurityHeaders(headers);
  return headers;
}

function addBaselineSecurityHeaders(headers) {
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('permissions-policy', PERMISSIONS_POLICY);
}

function addHtmlSecurityHeaders(headers) {
  headers.set('content-security-policy', CONTENT_SECURITY_POLICY);
}
