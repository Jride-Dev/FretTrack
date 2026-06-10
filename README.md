# FretTrack

![FretTrack logo and wordmark](images/logo_name.png)

FretTrack is live at [frettrack-app.com](https://frettrack-app.com).

FretTrack is a guitar and bass repair shop check-in and work order system for real bench workflow: customer intake, instrument details, inspection notes, damage photos, parts and services, payments, customer messages, print paperwork, and job history from drop-off to pickup.

## Try Out FretTrack Beta

[Try Out FretTrack Beta](https://frettrack-app.com)

The beta is invite-only. Applications are handled on the live FretTrack site.

## Current Status

Current milestone branch: `v0.2.63 beta candidate`

This includes:

- Customers foundation
- Inventory parts foundation
- Scheduling / Calendar Phase 1
- Premium entitlement foundation and Advanced Reporting Phase 1
- Photo Editor Phase 1 for job-photo markup and manual background cleanup
- Beta approval applicant email notifications
- Jobs, photos, damage map, work logs, accounting foundation, auth/RLS, and multi-shop architecture

Old live baseline:

- `v0.2.6-beta.14` remains the last older live beta baseline before the milestone version ladder.

Product milestone ladder:

- `v0.2.61 beta`: Customers complete
- `v0.2.62 beta`: Inventory complete
- `v0.2.63 beta`: Scheduling complete
- `v0.3.0 beta`: Operational Shop Release

## Recent Beta Updates Since beta6

- Beta access now uses a public application and operator approval flow.
- Approved beta users can now receive an access-approved email with the app login URL through the `notify-beta-approval` Supabase Edge Function.
- Customer and subcontractor records are now first-class workflows, not just fields on work orders.
- Work orders and invoices can now be emailed from inside the app.
- Existing work orders now support editable job-level parts and services.
- The app now has mobile/tablet readiness improvements and PWA install support.
- New work orders can be saved as local offline drafts and synced manually after reconnecting.
- Inventory parts foundation adds stock counts, movements, low-stock visibility, and job attachment.
- Scheduling Phase 1 adds internal shop scheduling for due dates, intake appointments, pickups, follow-ups, and shop blocks.
- Unsaved-changes protection now warns before losing manual edits on high-risk forms.
- Premium entitlement checks now centralize future paid-feature gating without blocking core shop workflow.
- Advanced Reporting Phase 1 adds premium-gated dashboard metrics for revenue, jobs, customers, and inventory.
- Photo Editor Phase 1 adds repair-shop photo markup, captions, crop, brightness, save-as-copy, guarded overwrite, and manual background cleanup.
- Print output has been improved for beta use, with a dedicated print renderer rebuild still planned for the Customer Damage Report and damage-map output.

## Not Included Yet

- Stripe billing or live payment automation.
- Full inventory receiving workflow, barcode labels, purchase history, vendors, purchase orders, and deeper stock management.
- Full offline mode for existing job edits, queued photo uploads, or cached authenticated Supabase data.
- Production SMS messaging.
- Public invoice or work-order links.
- Customer-facing appointment confirmations and external calendar sync.
- AI background removal or third-party image cutout APIs.

## Screenshots

![FretTrack photo editor with markup tools](docs/screenshots/photo_editor.jpg)

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
- [Photo editor](docs/PHOTO_EDITOR.md)
- [Deployment notes](docs/DEPLOYMENT_NOTES.md)
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
