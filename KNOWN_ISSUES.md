# Known Issues

Current version: `0.3.0`

This file lists active product boundaries and setup traps. Resolved prerelease defects remain in the changelog and release notes instead of being presented as current problems.

## Active product boundaries

### SMS is disabled

Email is active. SMS requires carrier registration, provider configuration, consent handling, delivery-status reconciliation, and a reviewed metered-cost model before it can be enabled safely.

### Offline continuity is limited to new-job drafts

FretTrack can preserve new work-order drafts locally and sync them deliberately after reconnecting. Existing-job edits, inventory receiving, purchase orders, photos, and authenticated Supabase records are not a general offline database.

### Customer instruments are stored on work orders

Instrument data is attached to each job. A separate customer-owned instrument registry with its own history and identifiers is future work.

### Public document links are not available

Customer documents can be printed or emailed from authenticated shop workflows. Public tokenized invoice or work-order links need an explicit expiration, revocation, authorization, and access-log design.

### Monetary edits use broad work-order write roles

Owners, admins, and technicians with work-order write access can edit applicable parts, services, discounts, and payments. More granular accounting permissions and finalized-total locking remain future commerce hardening.

### Customer import is not enabled

Import parsing and preview foundations exist, but reviewed batch persistence, duplicate merge decisions, and rollback are not available in the product UI.

### Advanced inventory and shipping integrations are future work

Vendor import/export, supplier APIs, vendor returns, forecasting, outbound/customer shipping, carrier rates, purchased labels, and automatic tracking notifications are outside 0.3.0.

### Historical timelines are not reconstructed completely

Activity is recorded from the event-system rollout forward. FretTrack does not invent detailed status, photo, payment, or work-log events for older records when no authoritative event exists.

### Supabase leaked-password protection depends on project plan

Email confirmation is required and anonymous/phone sign-in are disabled. Recheck password-strength and leaked-password protection whenever the Supabase project plan or Auth configuration changes.

## Setup traps

- The local app URL is normally `http://127.0.0.1:5173/`; PostgreSQL port `5432` is not a browser URL.
- Vite uses `strictPort`, so an existing process on port 5173 must be closed before starting another dev server.
- Fictional local testing must use local Supabase. The development startup guard rejects an unsafe hosted configuration.
- A migration-history entry does not prove a stale local database physically contains the expected schema; reset or reapply a disposable local stack when history and schema disagree.
- Supabase database dumps include Storage metadata, not the underlying object bytes. Use the FretTrack backup workflow for a complete recoverable snapshot.

## Messaging verification

For email-provider testing, keep `VITE_SMS_ENABLED=false`, send only to controlled addresses, confirm Message History, and verify that rejected sends release quota while provider-accepted sends retain a durable reconciliation record.

## Reporting defects

Use **Report Issue** inside FretTrack when possible or email `support@frettrack-app.com`. Include the affected shop role, work-order number, browser/device, expected result, actual result, and approximate time. Never include passwords, API keys, payment-card data, or unnecessary customer information.
