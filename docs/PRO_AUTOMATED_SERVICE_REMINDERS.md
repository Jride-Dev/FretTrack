# Pro Automated Service Reminders

Automated Service Reminders are a Pro/Enterprise feature for sending a customizable follow-up after a completed recurring service, such as a setup. The first release deliberately stays narrow: one shop-level rule, one configurable month interval, a list of eligible service keywords, one editable email template, and one optional booking URL.

## How it works

The customer profile records separate affirmative consent for automated service reminders. A customer must remain active, have an email address, and remain opted in. This consent is independent of transactional work-order email permission and can be withdrawn at any time. Removing the address also clears the opt-in when the customer is saved.

When a work order reaches Completed or Picked Up, FretTrack keeps the first durable completion timestamp. If a billed service description matches a configured keyword, the database creates a reminder due at that completion timestamp plus the configured number of calendar months. A later matching service for the same customer cancels the older unsent reminder, preventing a stale “time for service” email after the customer has already returned.

This feature does not use Resend scheduling. FretTrack keeps long-horizon due dates in Supabase and a single nightly Cron worker sends only reminders that are due. That avoids Resend’s 30-day scheduling limit and avoids creating one Cron job per customer.

Shop Settings leads with a customer-style sample preview rather than raw merge-tag syntax. Owners/admins open **Edit subject and message** only when they want to customize the copy, then insert customer, service, shop, month, or booking-link values through labeled personalization chips. Existing templates containing literal `\\n` sequences are normalized into real paragraph breaks when loaded and saved, so the editor, preview, Message History, and delivered plain-text email retain readable spacing. The preview uses the configured booking URL exactly; when the template includes the booking-link field but the URL is empty, it leaves the value blank and shows a setup warning instead of inventing a link customers would not receive.

## Safety boundaries

The UI is gated by `automated_service_reminders`, and the database independently grants it only to Pro and Enterprise shops. Owners and admins can manage the rule; shop members can inspect the queue; non-Pro shops cannot read or enable the rule. Claiming, validating, and finalizing deliveries are service-role-only database operations.

The nightly worker claims rows with `FOR UPDATE SKIP LOCKED`, uses a lease token, and snapshots the recipient, subject, and body before provider contact. It rechecks the current plan entitlement, enabled rule, active customer, unchanged email, affirmative consent, completed source job, and absence of a newer eligible service immediately before sending. Resend receives the queue delivery key as its idempotency key. The existing recipient quota is reserved and settled through the same usage ledger as other customer email, and each attempt is represented in Message History.

Ambiguous provider transport failures retain the same delivery key for retry. A finalized sent row cannot be replaced by a late failed retry because queue finalization requires the active processing token. Failed queue finalization is isolated so one damaged row cannot stop the rest of the nightly batch.

## Deployment requirements

Migration `20260822035953_pro_automated_service_reminders.sql` creates the entitlement, consent fields, completion timestamp, shop rule, durable queue, triggers, service-role functions, and named nightly Cron job. Deploy `send-service-reminders` with the migration.

The existing Edge Function secrets `RESEND_API_KEY`, `SHOP_EMAIL_FROM`, and `FRETTRACK_FUNCTION_KEY` are required. Supabase Vault must contain `frettrack_project_url`, `frettrack_anon_key`, and `frettrack_function_key`; the migration stores only their names. The named Cron job runs daily at 03:17 UTC and safely does nothing until those Vault values exist.

No remote migration, function deployment, Vault secret, or Cron change is performed merely by merging this source. Those production actions always require explicit deployment approval.

The production rollout completed on 2026-08-22. The migration is recorded remotely, all three named Vault entries are configured, `frettrack-service-reminders-nightly` is active at `17 3 * * *`, and `send-service-reminders` version 1 is active with JWT verification. An unauthenticated request returned `401`; an authenticated zero-work smoke returned `200` with no claimed or sent rows. Six shop rules were created disabled, so deployment did not opt customers in or send reminder email.

## Validation

```powershell
npm run check:automated-service-reminders
deno check supabase/functions/send-service-reminders/index.ts
npm run test:db
npm run check:permissions
npm run check:role-permissions
npm run check:tiers
npm run check:migrations
npm run build
git diff --check
```
