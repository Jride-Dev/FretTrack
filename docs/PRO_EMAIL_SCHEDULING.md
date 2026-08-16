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
- Scheduling requires the job's customer email opt-in. Existing immediate transactional email behavior is unchanged.
- The job, recipient, subject, body, provider ID, scheduled time, and cancellation time are stored as message-history snapshots. Later job or template edits do not rewrite the queued email.
- Authenticated clients cannot forge `scheduled` or `canceled` provider states through table writes. The service-role Edge Function owns those transitions.
- Cancellation is job-scoped and reuses the same owner/admin/tech write-access boundary as customer email sending.
- Each accepted schedule consumes the existing monthly recipient quota. Cancellation does not restore quota because the provider request was already accepted and FretTrack's current usage ledger has no provider-reversal state.
- Resend receives an idempotency key for each FretTrack request.

## Provider State

Resend owns the delivery clock for this slice. FretTrack displays **Scheduled with provider** before the delivery time and **Provider schedule elapsed** afterward. The latter means the provider-accepted schedule time passed; it is not a delivery receipt. Confirmed delivered/bounced state would require a separately secured Resend webhook and is intentionally outside this foundation.

Provider scheduling is limited to 30 days. The roadmap's six-/twelve-month customer service reminders will need Supabase Cron (or another long-horizon dispatcher) plus explicit consent/unsubscribe behavior; they should not be built by stretching this transactional feature.

## Database and Deployment

Migration `20260815095604_pro_email_scheduling_foundation.sql`:

- seeds `scheduled_email` plan entitlements;
- adds nullable `scheduled_at` and `canceled_at` message-history fields;
- extends message status with `scheduled` and `canceled`;
- adds a partial index for pending schedules; and
- restricts authenticated writes from fabricating provider scheduling state.

Deployment requires both the migration and the updated `send-email` Edge Function before the app build is released. No Supabase Cron job or new provider secret is required; the existing `RESEND_API_KEY`, `SHOP_EMAIL_FROM`, function key, and authenticated job access remain authoritative.

Production rollout completed on 2026-08-15: the migration is recorded remotely, `send-email` version 35 is active with JWT verification, and the matching Cloudflare Pages app bundle is live.

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
