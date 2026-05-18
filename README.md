# FretTrack

Current version: `0.2.6-beta.4`

`v0.2.6-beta.4` is Simon's Beta Release: a UK shop readiness pass with GBP, VAT wording, UK date display, metric measurement preferences, and lightweight accounting/report exports for beta tax-prep workflows.

FretTrack is a guitar and bass repair shop check-in and work order app. It helps repair shops track customer intake, instrument details, inspection notes, damage photos, parts, services, payments, customer messages, print paperwork, and job history from drop-off to pickup.

## Try Out FretTrack Beta Today

[Try Out FretTrack Beta today!](https://frettrack-app.com)

By invite only. Applications are being taken on the website. Click the link and fill out the form.

## Screenshots

![FretTrack beta screenshot 1](<Screenshots/Screenshot 2026-05-18 103335.jpg>)

![FretTrack beta screenshot 2](<Screenshots/Screenshot 2026-05-18 103528.jpg>)

![FretTrack beta screenshot 3](<Screenshots/Screenshot 2026-05-18 103601.jpg>)

![FretTrack beta screenshot 4](<Screenshots/Screenshot 2026-05-18 103642.jpg>)

![FretTrack beta screenshot 5](<Screenshots/Screenshot 2026-05-18 103738.jpg>)

![FretTrack beta screenshot 6](<Screenshots/Screenshot 2026-05-18 103844.jpg>)

## Current Position

- Public beta is live at [frettrack-app.com](https://frettrack-app.com).
- The app is deployed through Cloudflare Pages and backed by Supabase Auth, database, storage, and Edge Functions.
- Email notifications are active through Supabase Edge Functions and Resend.
- SMS plumbing exists, but SMS is disabled in beta builds until carrier registration is ready.
- Work orders, standalone customer records, damage maps, customer lookup, photo handling, payments, print sheets, activity timeline, and customer messaging are available.
- Simon's Beta Release adds UK-ready shop settings for GBP, VAT labels, DD/MM/YYYY dates, millimeter measurements, and accounting/report exports.

## Features

- Shop login with Supabase Auth.
- Shop membership foundation for owner/admin/tech/viewer roles.
- Job intake for acoustic, electric, and bass work.
- Standalone customer add/list/search and repeat-customer quick fill.
- Structured first and last name fields while preserving full-name display.
- Inspection fields for string gauges, neck relief, action, fret condition, neck condition, and notes.
- Damage map with view/area/severity markers and photo attachment support.
- Parts, labor/services, discounts, sales tax/VAT, payments, balance, and till summary handling.
- Lightweight accounting/reports tab with daily/monthly/yearly summaries and CSV export helpers.
- Shop-level currency, locale, tax/VAT label, date format, and measurement unit preferences.
- Work log entries that persist immediately.
- Email templates for check-in, estimate, approval, work started, repair complete, pickup reminder, payment reminder, and photo updates.
- Photo upload/gallery flow with HEIC/HEIF conversion support.
- Job print sheet and customer damage report.
- In-app beta announcements and issue reporting backed by Supabase.

## Development

Install dependencies:

```powershell
npm install
```

Start the Vite dev server:

```powershell
npm run dev
```

Open FretTrack in the browser:

```text
http://127.0.0.1:5173/
```

Build the production bundle:

```powershell
npm run build
```

Apply pending migrations to the local safe database:

```powershell
npm run db:local:apply
```

Seed five local-only test shops with fake customers, tickets, instruments, damage-map data, work logs, and report output:

```powershell
npm run seed:local-test-shops
```

The seed script refuses non-local database URLs unless explicitly overridden.

If `npm run dev` says port `5173` is already in use, close the old dev server first and run it again. The app is configured with `strictPort: true` so Vite fails clearly instead of silently moving to another port.

## Environment

Copy `.env.example` to `.env` for local development and fill in your own values.

```powershell
Copy-Item .env.example .env
```

Important:

- `.env` and `.env.*` are intentionally ignored by git.
- Do not commit Supabase service role keys, Resend keys, Twilio tokens, database URLs, JWT secrets, or shop-specific function keys.
- Browser-facing `VITE_*` values are public in built frontend code. Do not put provider secrets or service role keys in `VITE_*` variables.
- `VITE_SUPABASE_ANON_KEY` is public by design. Use Supabase Row Level Security and Edge Function authorization before using real shop data.

## Documentation

- [Changelog](CHANGELOG.md) tracks release-by-release changes.
- [Roadmap](ROADMAP.md) tracks planned product and security work.
- [Known Issues](KNOWN_ISSUES.md) tracks trial limitations, setup traps, and historical fixes.
- [Trial Readiness Checklist](docs/TRIAL_READINESS.md) covers first-shop testing.
- [Architecture Overview](ARCHITECTURE_OVERVIEW.md) explains the main modules and data flow.
- [Supabase Migration Workflow](docs/supabase-migrations.md) explains the migration-history preflight and recovery rules.
- [Docs Home](docs/README.md) links deeper setup and deployment notes.

## Security

Read [SECURITY.md](SECURITY.md) before making the repository public or connecting real services.

Short version:

- Keep `.env` files private.
- Rotate any Supabase service role key, Resend key, Twilio token, database URL password, JWT secret, or FretTrack function key immediately if it is ever exposed.
- Treat beta data carefully and keep RLS enabled for shop-scoped tables.

## Security Automation

This repo includes:

- Dependabot npm updates in `.github/dependabot.yml`.
- A GitHub Actions `npm audit` workflow in `.github/workflows/security.yml`.

Run this locally before publishing or cutting a release:

```powershell
npm audit --audit-level=moderate
npm run check:migrations
npm run build
```

Before creating or applying Supabase migrations, run:

```powershell
npm run check:migrations
```

This fails when the remote database has migration versions missing from `supabase/migrations`, which means local history needs to be recovered before any new migration is pushed.

## License

FretTrack is proprietary software. See [LICENSE](LICENSE).
