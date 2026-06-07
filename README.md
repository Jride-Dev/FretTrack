# FretTrack

![FretTrack logo and wordmark](images/logo_name.png)

Live baseline: `v0.2.6-beta.14`

FretTrack is live at [frettrack-app.com](https://frettrack-app.com).

FretTrack is a guitar and bass repair shop check-in and work order system for real bench workflow: customer intake, instrument details, inspection notes, damage photos, parts and services, payments, customer messages, print paperwork, and job history from drop-off to pickup.

## Try Out FretTrack Beta

[Try Out FretTrack Beta](https://frettrack-app.com)

The beta is invite-only. Applications are handled on the live FretTrack site.

## Current Beta Direction

`v0.2.6-beta.14` is the old live beta baseline. The current branch is organized around product milestones: `v0.2.61 beta` for customers complete, `v0.2.62 beta` for inventory complete, `v0.2.63 beta` for scheduling complete, and `v0.3.0 beta` for the Operational Shop Release.

## What Is Available In This Branch

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
- Inventory parts foundation with stock counts, low-stock visibility, inventory movements, and job attachment.
- Shop settings for GBP/USD, VAT/sales tax labels, localized date formats, and imperial/metric measurement preferences.
- Work logs, activity timeline, in-app announcements, and issue reporting.
- Email templates plus in-app work-order and invoice email sending through Supabase Edge Functions and Resend.
- PWA install support, mobile/tablet layout improvements, and camera-first photo capture.
- Offline local draft queue for new work orders when the connection fails.
- Job print sheet and customer damage report.
- Scheduling / Calendar Phase 1 with week view, internal schedule events, job/customer links, Job Detail scheduling, and an upcoming schedule panel.

## Recent Beta Updates Since beta6

- Beta access now uses a public application and operator approval flow.
- Customer and subcontractor records are now first-class workflows, not just fields on work orders.
- Work orders and invoices can now be emailed from inside the app.
- Existing work orders now support editable job-level parts and services.
- The app now has mobile/tablet readiness improvements and PWA install support.
- New work orders can be saved as local offline drafts and synced manually after reconnecting.
- Inventory parts foundation adds stock counts, movements, low-stock visibility, and job attachment.
- Scheduling Phase 1 adds internal shop scheduling for due dates, intake appointments, pickups, follow-ups, and shop blocks.
- Print output has been improved for beta use, with a dedicated print renderer rebuild still planned for the Customer Damage Report and damage-map output.

## Not Included Yet

- Stripe billing or live payment automation.
- Full inventory receiving workflow, barcode labels, purchase history, vendors, purchase orders, and deeper stock management.
- Full offline mode for existing job edits, queued photo uploads, or cached authenticated Supabase data.
- Production SMS messaging.
- Public invoice or work-order links.
- Customer-facing appointment confirmations and external calendar sync.

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
