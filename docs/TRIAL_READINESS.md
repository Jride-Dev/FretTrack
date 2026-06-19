# FretTrack v0.2.8-beta.0 Trial Readiness Checklist

Use this checklist before handing a build to a real trial shop.

## Required Env Vars

Frontend `.env`:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FRETTRACK_SHOP_ID=default-shop
VITE_FRETTRACK_SHOP_NAME=FretTrack Trial Shop
VITE_FRETTRACK_FUNCTION_KEY=
VITE_SMS_ENABLED=false
```

Supabase Edge Function secrets:

```text
FRETTRACK_FUNCTION_KEY=
RESEND_API_KEY=
SHOP_EMAIL_FROM=
```

## Supabase Setup

1. Create or select the shop Supabase project.
2. Apply the schema and migrations listed below.
3. Confirm the `job-images` and `shop-assets` storage buckets exist and are private.
4. Enable Supabase Auth email/password sign-in for trial users.
5. Deploy `send-email`.
6. Keep `send-sms` deployed only as dormant scaffolding while SMS is disabled.
7. Set Edge Function secrets.
8. Sign in through FretTrack and create the first shop owner if the shop has no members yet.
9. Send a test email through the app.

## Migrations Required

Apply all current schema changes, including:

- `supabase-schema.sql`
- `supabase/migrations/20260511124500_add_shop_scoped_job_numbers.sql`
- `supabase/migrations/20260511133000_add_job_events.sql`
- `supabase/migrations/20260513055709_add_auth_shop_memberships.sql`
- `supabase/migrations/20260514035528_shop_scope_rls_audit.sql`
- `supabase/migrations/20260514215512_add_shop_profile_onboarding.sql`
- `supabase/migrations/20260514220946_drop_legacy_public_job_image_storage_policies.sql`

## Auth / Shop Access Test

1. Start the app with `npm run dev`.
2. Confirm the app shows the sign-in screen when Supabase is configured.
3. Create or sign into a Supabase Auth user.
4. If the signed-in user has no shops, enter the shop name and click `Create My Shop`.
5. Complete the first-run shop onboarding profile.
6. Confirm the app loads jobs only after shop membership and shop onboarding are available.
7. If the signed-in user has more than one shop, confirm the shop picker appears and only the selected shop opens.
8. Sign out and confirm the app returns to the sign-in screen.

## Paid Access Trial Test

Beta access approval is separate from paid access trial state. A user may be approved for the beta and still have an expired or inactive shop trial.

1. Sign in as a platform operator.
2. Open the internal Operator Dashboard.
3. Confirm normal shop owners/admins/techs/viewers do not see the Operator Dashboard unless they are also listed in `public.operator_users`.
4. Start a 7-day Shop trial for a test shop and confirm Photo Editor and Team Members become available while Advanced Reporting stays locked.
5. Start a 7-day Pro trial for a test shop and confirm Advanced Reporting becomes available.
6. Start 14-day and 30-day trials on the same test shop and confirm the trial end date is reset from now, not extended from the old date.
7. Extend the trial by 7, 14, and 30 days and confirm each extension starts from the greater of the existing trial end or now.
8. End the trial and confirm the lifecycle becomes expired, stored tier is preserved, and writes are blocked without deleting data:
   - customers
   - jobs
   - photos
   - photo gallery and customer-report photo selection
   - damage maps
   - work logs
   - scheduling
   - inventory basics
   - printing
   - email documents
9. Confirm expired-trial actions are blocked for create/edit/send/upload paths while existing records remain viewable where safe.
10. Confirm feature locks after trial expiry:
   - Photo Editor shows `Available on Shop`
   - Advanced Reporting shows a Pro placeholder
   - Team Members shows a Shop lock in Shop Settings
11. Confirm existing non-owner staff memberships are preserved but cannot access the shop while access is expired.
12. Restore a Shop or Pro trial and confirm preserved staff memberships regain access without recreating them.
13. Confirm viewer users remain read-only.
14. Confirm Stripe, billing webhooks, and payment collection are not shown as connected.

## Test Job Creation Flow

1. Confirm the header shows the onboarded shop name.
2. Create a job with first name, last name, instrument type, brand/model, and reason for visit.
3. Confirm the job number uses `YYDDD-SEQ`.
4. Open the saved job.
5. Change status to `On Bench`, save, and confirm no error appears.
6. Add a work log entry and save.
7. Add a payment and save.
8. Confirm Activity Timeline shows creation/update/status/payment/work-log events after the migration is applied.

## Image Upload Test

1. Open a saved job.
2. Upload one normal image.
3. Confirm the image appears in the job.
4. Mark it for the work order.
5. Delete the image.
6. Confirm Activity Timeline shows upload/delete events after the migration is applied.

## Print Test

1. Open Shop Settings.
2. Enter shop name, phone, email, address, tax defaults, logo, and print footer text.
3. Save settings.
4. Open a job and print the Job Sheet.
5. Print the Customer Damage Acknowledgment.
6. Confirm no hardcoded business name appears and footer text prints.

## Backup / Export Warning

Before real shop testing, confirm the Supabase project has a backup plan and that the operator can export data if a trial shop needs support.

See [Beta Operations](BETA_OPERATIONS.md) for backup awareness, export paths, recovery notes, and current beta limitations.

For single-job debugging, use `Export Job JSON` from Job Detail.

## Known Limitations

- Authentication now gates Supabase-configured builds, but user invitation/admin screens are not implemented yet.
- SMS is not enabled yet.
- Activity timeline requires the `job_events` migration.
- Shop profile onboarding now persists remote shop settings and logo storage.
- Monetary controls are not permission-gated yet.
- Negative parts/services prices are blocked unless explicitly allowed in job data.
- Supabase migrations must be applied manually in the current workspace because the CLI/database credentials are not available here.
- Shop Tier Foundation Phase 1 does not enforce pricing, storage caps, SMS limits, or Stripe billing.
