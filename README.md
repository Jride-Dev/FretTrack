# FretTrack

![FretTrack logo and wordmark](images/logo_name.png)

<a href="https://devglobe.app/projects/frettrack?utm_source=badge&utm_medium=embed" target="_blank" rel="noopener">
  <img src="https://devglobe.app/badges/launched-on-devglobe-dark.svg" alt="Launched on DevGlobe" width="250" height="54" />
</a>

FretTrack is live at [frettrack-app.com](https://frettrack-app.com).

Current version: `0.3.1`

FretTrack is professional workflow software for guitar, bass, amplifier, and keyboard repair shops. It keeps customer intake, focused bench work, inspection records, photos, inventory, purchasing, scheduling, customer communication, billing, print documents, payments, and repair history connected from drop-off through pickup.

## Access and plans

[Start a Free 14-Day Trial](https://app.frettrack-app.com/?signup=1)

New email-confirmed accounts can create one workspace and receive a non-converting 14-day Pro trial with no card required. Shop is $29.99 monthly or $299.99 yearly. Pro is $39.99 monthly or $399.99 yearly. Paid enrollment and subscription management use Stripe Checkout and the Stripe Billing Portal.

Public product documentation, release notes, support, privacy, and terms are available at [frettrack-app.com/docs](https://frettrack-app.com/docs).

## Current stable release

FretTrack `v0.3.1` is the current stable maintenance release over the Operational Shop Release. It includes:

- focused Guitar, Amplifier, and Keyboard repair benches;
- one shared work-order workspace for parts, services, payments, messages, scheduling, photos, printing, and history;
- customer and subcontractor management;
- inventory, vendors, purchase orders, receiving, landed costs, barcode labels, and specialist purchasing;
- Scheduling and Current Jobs workspaces;
- immediate email, Pro Scheduled Email, opted-in Automated Service Reminders, and Message History;
- simple editable Estimate documents selected from the work-order Document Type dropdown, with print/email output, retry-safe delivery identity, and compatibility approval links for older records;
- Pro Loyalty, Team Members, Team Assignment, Photo Editor, and Advanced Reporting;
- isolated Customer Service and Condition Report and invoice-style Job Sheet print renderers;
- accounting-safe work-order exclusion with payment-history safeguards;
- Shop/Pro usage limits, subscription lifecycle synchronization, and role-aware write protection;
- private repair photos, shop-scoped Row Level Security, guarded RPCs, and deployment checks;
- daily hosted database and Storage snapshots plus a tested local restore workflow.

FretTrack is a business-use software service operated by Jeffrey Russell d/b/a Torrance Guitar Repair.

## Known boundaries

- SMS is not enabled.
- Customer Conversation, the Unassigned Inbox, deliberate work-order routing, and selected correspondence in customer reports are available. The signed Resend inbound-email schema is deployed, but the production `receive-email` function, receiving routes, and webhook secrets are not enabled; SMS and browser Realtime remain disabled.
- Existing-job edits do not have full offline synchronization; offline continuity is limited to new-job drafts.
- Public invoice and work-order links are not implemented; estimate links are available for sent and approved revisions.
- Customer-owned instruments do not yet have an independent asset/profile table outside work orders.
- Advanced supplier, carrier, forecasting, vendor-return, and customer-shipping integrations remain future work.
- FretTrack does not replace professional accounting, tax, or legal advice.

## Development

Install dependencies and start the app:

```powershell
npm ci
npm run dev
```

Local authenticated development uses fictional fixtures and local Supabase:

```powershell
supabase start
npm run test:e2e:seed
npm run dev:test
```

Do not point fictional local testing at hosted production data.

## Validation

The GitHub quality workflow runs focused regression checks, a production build, pgTAP/RLS tests, isolated fixture seeding, and 29 Playwright tests. Release work also runs migration-history comparison, production configuration checks, and the documented deployment smoke sequence.

Key commands:

```powershell
npm run check:version-consistency
npm run check:stable-release
npm run check:migrations
npm run test:db
npm run test:e2e
npm run build
npm run deploy:app:production:check
```

## Documentation

- [Release notes](docs/RELEASE_NOTES.md)
- [Roadmap](ROADMAP.md)
- [Documentation index](docs/README.md)
- [0.3.1 release validation](docs/RELEASE_VALIDATION_CHECKLIST.md)
- [Operations and recovery](docs/OPERATIONS.md)
- [Deployment notes](docs/DEPLOYMENT_NOTES.md)
- [Pricing and tiers](docs/PRICING_AND_TIERS.md)
- [Stripe billing](docs/STRIPE_SELF_SERVE_BILLING.md)
- [Architecture health](docs/ARCHITECTURE_HEALTH_AUDIT_0.3.1.md)
- [Security policy](SECURITY.md)

## License

FretTrack is proprietary software. See [LICENSE](LICENSE).
