# Pro Scheduled Email

FretTrack's initial Pro Scheduled Email feature schedules an already-composed transactional job email for delivery up to 30 days ahead. It does not implement recurring marketing campaigns or the separate six-/twelve-month service-reminder roadmap item.

## Workflow

From a job's **Print** tab and **Work Order Messages** section, a writable Pro user can:

1. choose a template or edit the subject and body;
2. choose a future local date/time from 2 minutes through 30 days ahead;
3. schedule the email with Resend; and
4. cancel it from Message History before its delivery time.

The **Drop Off Scheduled** template uses the job's stored drop-off appointment and includes: “Your appointment is scheduled for [date and time].” If no appointment exists, the preview uses neutral fallback wording so it never invents a date.

## Safety and Authority

- `scheduled_email` is false for Free/Solo/Shop/Trial and true for Pro/Enterprise compatibility rows.
- The UI gate is convenience only. `send-email` independently checks authenticated job write access and the current shop entitlement before calling Resend.
- After reserving quota, `send-email` rechecks current write access, email opt-in, and scheduled-email entitlement immediately before calling Resend. If access changed, it releases the reservation and does not schedule the email.
- Every send now claims a durable pending Message History row before contacting Resend. The stable request ID is shared by provider idempotency, quota handling, and history reconciliation, so a timeout retry cannot create a second history row.
- A transport timeout or a provider response without a usable message ID remains **Provider confirmation pending**. FretTrack does not release that operation or issue a fresh ID; retrying reuses the same Resend idempotency key.
- Scheduled messages also carry a server-computed operation fingerprint. Concurrent identical schedules for the same work order resolve to the already-claimed operation instead of creating another provider request.
- Scheduling requires the job's customer email opt-in. Existing immediate transactional email behavior is unchanged.
- The job, recipient, subject, body, provider ID, scheduled time, and cancellation time are stored as message-history snapshots. Later job or template edits do not rewrite the queued email.
- Authenticated clients cannot forge `scheduled` or `canceled` provider states through table writes. The service-role Edge Function owns those transitions.
- Cancellation is job-scoped and reuses the same owner/admin/tech write-access boundary as customer email sending.
- Cancellation first records a `canceling` state. A timeout therefore appears as **Cancellation pending confirmation**, and retrying that cancellation repairs the same row rather than leaving a misleading scheduled record.
- Provider reconciliation locks the Message History row and applies terminal-state precedence atomically. Once delivery is recorded, a delayed canceled, failed, or nonterminal result returns the stored sent row instead of replacing its status or timestamp. Older non-delivery observations also cannot replace newer provider metadata.
- Each accepted schedule consumes the existing monthly recipient quota. Cancellation does not restore quota because the provider request was already accepted and FretTrack's current usage ledger has no provider-reversal state.
- Resend receives an idempotency key for each FretTrack request.

## Provider State

Resend owns the delivery clock for this slice. FretTrack displays **Scheduled with provider** before the delivery time and briefly displays **Provider schedule elapsed** if the local clock advances before reconciliation completes. When a scheduled time elapses—or a cancellation is uncertain—the authenticated message view reconciles elapsed schedules against Resend's retrieve-email endpoint and records `sent`, `failed`, or `canceled` on the existing row. Explicit `canceled` and `cancel_accepted` provider results finalize the cancellation timestamp; sent or delivered results always remain sent. While the message view remains open, unresolved provider states are checked again every 30 seconds until they become terminal. This is authenticated, on-demand polling rather than a real-time delivery webhook.

Provider scheduling is limited to 30 days. The roadmap's six-/twelve-month customer service reminders will need Supabase Cron (or another long-horizon dispatcher) plus explicit consent/unsubscribe behavior; they should not be built by stretching this transactional feature.

## Database and Deployment

Migration `20260815095604_pro_email_scheduling_foundation.sql`:

- seeds `scheduled_email` plan entitlements;
- adds nullable `scheduled_at` and `canceled_at` message-history fields;
- extends message status with `scheduled` and `canceled`;
- adds a partial index for pending schedules; and
- restricts authenticated writes from fabricating provider scheduling state.

Follow-up migration `20260816004706_harden_email_provider_consistency.sql`:

- adds durable request, quota, operation-fingerprint, provider-event, and cancellation-intent fields;
- adds unique claims for request retries and concurrent identical schedules;
- adds honest `pending` and `canceling` states; and
- keeps all provider-operation metadata service-owned under RLS.

Race-hardening migration `20260816032817_guard_email_provider_terminal_state.sql`:

- adds a service-role-only provider reconciliation transition;
- serializes concurrent reconciliation with a row lock;
- makes recorded delivery irreversible; and
- rejects older non-delivery observations before they can replace newer provider state.

Deployment requires the migrations and matching `send-email` Edge Function before the app build is released. No Supabase Cron job or new provider secret is required; the existing `RESEND_API_KEY`, `SHOP_EMAIL_FROM`, function key, and authenticated job access remain authoritative.

The foundation, provider-consistency, and race-hardening rollout completed on 2026-08-15. Migration `20260816032817_guard_email_provider_terminal_state.sql` is recorded remotely, `send-email` version 38 is active with JWT verification, and the matching Cloudflare Pages app deployment is live.

## Validation

```powershell
npm run check:pro-email-scheduling
deno check supabase/functions/send-email/index.ts
npm run test:db
npx playwright test tests/e2e/authenticated/pro-email-scheduling.spec.js tests/e2e/shop-authenticated/pro-email-scheduling-gate.spec.js
npm run check:role-permissions
npm run check:tiers
npm run build
git diff --check
```
