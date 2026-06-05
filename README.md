# FretTrack

Current version: `0.2.6-beta.14`

FretTrack is live at [frettrack-app.com](https://frettrack-app.com).

FretTrack is a guitar and bass repair shop check-in and work order system for real bench workflow: customer intake, instrument details, inspection notes, damage photos, parts and services, payments, customer messages, print paperwork, and job history from drop-off to pickup.

## Try Out FretTrack Beta

[Try Out FretTrack Beta](https://frettrack-app.com)

The beta is invite-only. Applications are handled on the live FretTrack site.

## Current Beta

`v0.2.6-beta.14` is the current live beta baseline. It includes the beta access approval gate, internal operator dashboard, customer and subcontractor management, work-order and invoice email flow, editable job-level parts and services, PWA/mobile improvements, image optimization, and an offline local draft queue for new work orders.

## What Is Live Now

- Live hosted app at [frettrack-app.com](https://frettrack-app.com).
- Cloudflare Pages frontend backed by Supabase Auth, database, storage, and Edge Functions.
- Invite-only beta application and approval flow.
- Internal operator dashboard for beta approvals, shop/member visibility, usage review, beta-bypass handling, trial extension, and status control.
- Shop login with owner/admin/tech/viewer membership foundation.
- Work order intake for acoustic, electric, bass, extended-range, and custom string-count instruments.
- Standalone customer and subcontractor management with profiles, balances, payment history, and CRM-style lookup.
- Damage map with view/area/severity markers and photo attachment support.
- Photo upload and gallery flow with HEIC/HEIF support and client-side image optimization.
- Parts, services, discounts, tax/VAT, payments, balance, and lightweight accounting/report summaries.
- Editable job-level parts and services after work order creation.
- Shop settings for GBP/USD, VAT/sales tax labels, localized date formats, and imperial/metric measurement preferences.
- Work logs, activity timeline, in-app announcements, and issue reporting.
- Email templates plus in-app work-order and invoice email sending through Supabase Edge Functions and Resend.
- PWA install support, mobile/tablet layout improvements, and camera-first photo capture.
- Offline local draft queue for new work orders when the connection fails.
- Job print sheet and customer damage report.

## Recent Beta Updates Since beta6

- Beta access now uses a public application and operator approval flow.
- Customer and subcontractor records are now first-class workflows, not just fields on work orders.
- Work orders and invoices can now be emailed from inside the app.
- Existing work orders now support editable job-level parts and services.
- The app now has mobile/tablet readiness improvements and PWA install support.
- New work orders can be saved as local offline drafts and synced manually after reconnecting.
- Print output has been improved for beta use, with a dedicated beta15 print renderer rebuild planned for the Customer Damage Report and damage-map output.

## Not Included Yet

- Stripe billing or live payment automation.
- Inventory, vendors, SKUs, purchase orders, or stock tracking.
- Full offline mode for existing job edits, queued photo uploads, or cached authenticated Supabase data.
- Production SMS messaging.
- Public invoice or work-order links.

## Screenshots

![FretTrack beta screenshot 1](<Screenshots/Screenshot 2026-05-18 103335.jpg>)

![FretTrack beta screenshot 2](<Screenshots/Screenshot 2026-05-18 103528.jpg>)

![FretTrack beta screenshot 3](<Screenshots/Screenshot 2026-05-18 103601.jpg>)

![FretTrack beta screenshot 4](<Screenshots/Screenshot 2026-05-18 103642.jpg>)

![FretTrack beta screenshot 5](<Screenshots/Screenshot 2026-05-18 103738.jpg>)

![FretTrack beta screenshot 6](<Screenshots/Screenshot 2026-05-18 103844.jpg>)

## Documentation

- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)
- [Release notes](docs/RELEASE_NOTES.md)
- [Architecture review beta 14](docs/ARCHITECTURE_REVIEW_BETA14.md)
- [Print renderer rebuild plan](docs/PRINT_RENDERER_REBUILD_PLAN.md)
- [Security review checklist](docs/SECURITY_REVIEW_CHECKLIST.md)
- [Supabase migration workflow](docs/supabase-migrations.md)
- [Docs home](docs/README.md)

## Security

Read [SECURITY.md](SECURITY.md) before making repository, deployment, or service-credential changes.

Short version:

- Keep environment files and service credentials private.
- Rotate any exposed Supabase service role key, Resend key, Twilio token, database URL password, JWT secret, or FretTrack function key immediately.
- Treat beta data carefully and keep Supabase Row Level Security enabled for shop-scoped tables.

## License

FretTrack is proprietary software. See [LICENSE](LICENSE).
