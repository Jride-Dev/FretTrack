# Known Issues

Current version: `0.2.61`

This file tracks known bugs, setup traps, trial limitations, and historical break/fix notes that are useful when debugging regressions.

## Active Trial Limitations

### Customer import workflow is not built yet

- Status: Future release change.
- Current behavior: Customers can now be created without a work order and records include import-ready fields.
- Limitation: Bulk Excel/CSV import, import review, duplicate merge, and rollback are not implemented yet.
- Planned fix: Add a customer import screen that stages spreadsheet rows, flags likely duplicates, then creates/updates customer records in a reviewed batch.

### Accounting totals are not permission-gated yet

- Status: Future release change.
- Current behavior: Role-level write protection is in place, but discount and monetary controls are still editable directly by users with write access to the work order UI.
- Problem: Once a discount is applied, it should become part of the saved work order totals and should not remain casually editable. Reopening an existing work order should expose an intentional `Edit Totals` action only when monetary edits are needed.
- Tax concern: Discounts, taxes, labor totals, parts totals, and balance-affecting edits need stronger audit behavior before broader shop/member use.
- Planned fix: Modularize accounting, lock applied totals, and allow regular employees to add payments without giving them access to edit already-applied monetary portions.

### Shop settings are local trial settings

- Status: Known trial limitation.
- Current behavior: Shop settings are stored in browser local storage with environment fallbacks. The UI only allows owner/admin roles to edit settings in authenticated builds, but the settings are not database-backed.
- Future fix: Move shop settings into authenticated organization/shop records with `shop_id`, RLS, and owner/admin-only write policies.

### Job image delivery still uses public URLs

- Status: Known trial limitation.
- Current behavior: `job_images` metadata and Storage object mutations are shop-role protected, but the `job-images` bucket still uses public URLs for display and print workflows.
- Risk: Anyone with a public image URL can view that image.
- Planned fix: Move job images to a private bucket or signed URL delivery before broader production use.

### Instruments are not a standalone customer asset table yet

- Status: Future release change.
- Current behavior: Instrument details live on work orders, and the instrument catalog is local code.
- Limitation: Customer-owned instruments/assets do not yet have their own `shop_id`-scoped table or RLS policies.
- Planned fix: Add a customer instruments/assets module linked by `customer_id` and `shop_id`.

### SMS is disabled in trial builds

- Status: Known limitation.
- Current behavior: SMS buttons are visible but disabled.
- Expected disabled message: `SMS is disabled for this trial build. Email is active.`
- Reason: SMS requires carrier registration and is planned for later.
- Current setting: `VITE_SMS_ENABLED=false`.
- Related changes: `v0.1.10-beta` added Twilio SMS plumbing; `v0.1.11` removed Twilio from required trial setup and disabled SMS for trial builds.

### Auth member management is incomplete

- Status: Known limitation.
- Current behavior: Supabase-configured builds require sign-in and shop membership, and the first signed-in user can bootstrap the first shop owner when a shop has no members.
- Limitation: There is not yet a member invitation or member-management screen.
- Future fix: Add shop member administration, invitations, role editing, and `job_events.created_by` wiring.
- Related setup values:

```text
FRETTRACK_FUNCTION_KEY=<same random value>
VITE_FRETTRACK_FUNCTION_KEY=<same random value>
```

Generate the key with:

```sh
openssl rand -hex 32
```

### Existing timeline history is partially backfilled

- Status: Known v0.2.5 limitation.
- Current behavior: Existing jobs have a backfilled `Job created` event, and new activity is logged going forward.
- Limitation: Detailed historical events before the timeline migration, such as older status changes or photo uploads, are not reconstructed.
- Planned fix: Add deeper historical backfill only if trial shops need it.

### Supabase/Postgres port is not the app URL

- Status: Common setup trap.
- Correct app URL: `http://127.0.0.1:5173/`
- Database port in `.env`: `5432`
- Notes: The `:5432` address is the Supabase Postgres database port. It is not the browser URL for this app.
- Related fix: `v0.1.1` clarified the local app URL and database port distinction.

### Vite will fail if port 5173 is already in use

- Status: Intentional behavior.
- Current behavior: The app uses `strictPort: true`.
- Fix: Close the old dev server first, then run `npm run dev` again.
- Reason: Vite should fail clearly instead of silently moving to another port.
- Related fix: `v0.1.1` added strict Vite port settings.

## Messaging Provider Test Checklist

Trial builds use email-only messaging. SMS requires carrier registration and will be added later.

Local frontend `.env`:

```text
VITE_FRETTRACK_FUNCTION_KEY=<same random value>
VITE_SMS_ENABLED=false
```

Supabase Edge Function secrets:

```text
FRETTRACK_FUNCTION_KEY=<same random value>
RESEND_API_KEY=<Resend API key>
SHOP_EMAIL_FROM=<verified sender email>
```

Checklist:

1. Confirm `VITE_SMS_ENABLED=false` for trial builds.
2. Send test email to your own email.
3. Confirm the send appears in message history.
4. Confirm SMS buttons are visible but disabled with this message: `SMS is disabled for this trial build. Email is active.`

## Historical Break/Fix Notes

### Auth/RLS rollout blocked saves inside local-only jobs

- Fixed in: `v0.2.6`.
- Problem: Some work orders existed only in browser local storage after the auth/shop-membership rollout. Child records such as work logs, images, messages, parts, services, and activity events could then fail RLS because Supabase had no parent `jobs` row to authorize against.
- Fix: Job save, photo upload, and customer messaging now verify or create the remote parent work order before syncing child records. Child-table RLS now consistently checks shop membership through the parent job.

### Duplicate work orders could be created by repeated submits

- Fixed in: `v0.2.6`.
- Problem: Slow network saves or repeated clicks could attempt to create multiple work orders for the same shop/job number.
- Fix: The app now blocks repeat submit attempts, checks local and remote duplicates before creating a job, and surfaces `MULTIPLE WORK ORDERS CANNOT BE CREATED FOR [JobID, WORKORDER NUMBER]`. The remote numbered-job function is also idempotent by shop/job number.

### Appended work order history disappeared after closing a job

- Fixed in: `v0.2.3`.
- Problem: `Append Entry` updated only the open work-order draft. The old child-table sync could also fail quietly, allowing Save Job to appear successful even if Supabase did not persist work log rows.
- Likely trigger: Finishing a job as `Picked up` saved the work order again. Before the sync was hardened, that follow-up save could delete existing `work_logs` before failing to write the replacement rows.
- Fix: Appended work log entries now save immediately. Deleted entries also save immediately, edited entries save when leaving the edited log field, and Supabase work log errors now block the success message. Work logs are now upserted before stale rows are deleted. Finish / Picked Up now uses the explicit save path and surfaces save errors.

### Work log save failed on older `work_logs` schema

- Fixed in: `v0.2.3`.
- Problem: Some Supabase installs had a `work_logs` table with `entry` but no duplicate `text` column. Saving a job could fail with `Could not find the 'text' column of 'work_logs' in the schema cache`.
- Fix: Work log inserts and sync now retry with the older `entry`-only row shape when Supabase reports the missing `text` column. The schema file also now includes `alter table work_logs add column if not exists text text not null default ''`.

### Image uploads expected `job_images.public_url`

- Fixed in: `v0.2.3`.
- Problem: Image uploads used a `job_images.public_url` column that was missing from the Supabase schema.
- Fix: Added the missing Supabase `job_images.public_url` column.

### Damage-map pictures did not reliably show after import

- Fixed in: `v0.2.3`.
- Problem: Damage-map view images and marker photos could fail to show on new jobs or after an upload/save refresh race. When a storage upload did not create a fresh image record, the UI could show nothing or reuse an older damage image from the same category.
- Fix: Damage-map imports now use the shared image upload path when possible, skip the job-list refresh race during damage imports, require a newly-created image record before using an uploaded URL, and fall back to a compressed local preview so the selected picture shows immediately. Marker photos now display thumbnail previews in the damage list.

### Customer name search needed first/last name structure

- Fixed in: `v0.2.3`.
- Problem: Search and lookup depended on combined `customer_name`, which limited first/last name lookup.
- Fix: Added `customer_first_name` and `customer_last_name`, backfilled from `customer_name`, and added lookup indexes while preserving `customer_name` for display and templates.

### Damage-map persistence needed to carry into live baseline

- Fixed by: `v0.2.0` baseline carry-forward.
- Problem: Damage-map data needed persistence reliability before real shop testing.
- Fix: The live baseline carried forward damage-map persistence fixes.

### Work log entries needed edit/delete controls

- Fixed in: `v0.1.11`.
- Problem: Work log entries could be added, but day-to-day corrections needed direct edit/delete controls.
- Fix: Added edit and delete controls for work log entries.

### Tech Detail typing lag

- Fixed in: `v0.1.4`.
- Problem: String gauges, action fields, neck relief, and neck inspection fields lagged while typing.
- Fix: These fields now update locally while typing and save on blur or with Save Job.

### Fake test customer record from old save behavior

- Fixed in: `v0.1.4`.
- Problem: The old `Test Supabase Save` behavior created a fake test customer record.
- Fix: Renamed the action to `Save Job` and removed the fake test customer creation.

### Multiple jobs on the same date needed unique numbers

- Fixed in: `v0.1.3`.
- Problem: Same-day jobs could collide on the base date-derived job number.
- Fix: Additional jobs now receive suffixes like `26122-01`, `26122-02`, and so on.

### Supabase bucket size pressure from images

- Mitigated in: `v0.1.2`.
- Problem: Large original uploads could quickly consume the 50MB Supabase bucket limit.
- Fix: Browser-side compression resizes images to a maximum long edge of `1600px` and converts uploads to JPEG at reduced quality.

### Deleted images needed full cleanup

- Fixed in: `v0.1.2`.
- Problem: Deleted images needed to remove both file storage and database references.
- Fix: Deleting an image removes the Supabase Storage object and the `job_images` database row.
