# FretTrack Beta Operations

Use this during the one-tester beta. The goal is to preserve data, know how to export it, and avoid turning beta feedback into a feature spree.

## Automatic Supabase Backups Awareness

Supabase database backups are managed in the Supabase project dashboard under database backups. Before a tester uses real shop data, confirm the project plan and backup status in Supabase.

Check before beta:

1. Open the Supabase project.
2. Go to Database Backups.
3. Confirm the project has backups available for its current plan.
4. Note the latest successful backup time.
5. Note whether point-in-time recovery is available for the current plan.
6. Keep the Supabase project ref with the beta notes.

Important: Supabase database backups cover Postgres data. They do not back up Storage objects. FretTrack job photos and shop logos live in Supabase Storage, so they need a separate export or retention plan if the tester starts uploading important real images.

Beta rule: for one tester, treat Storage images as useful working copies, not the only archival source. Ask the tester to keep original repair photos on their device during beta.

## Export Path For Jobs And Customers

Current app export:

- Single job JSON: open a job, then use `Export Job JSON`.
- The export includes the job and timeline events.
- This is the fastest support path when one job looks wrong.

Manual Supabase export path:

1. In Supabase Table Editor, export `customers` filtered to the beta `shop_id`.
2. Export `jobs` filtered to the beta `shop_id`.
3. Export child records if needed: `job_parts`, `job_services`, `work_logs`, `job_images`, `customer_messages`, `job_events`, `transaction_events`, and `payment_events`.
4. Export `shop_profiles` for the beta `shop_id`.
5. Download Storage objects separately from `job-images` and `shop-assets`.

CLI export path for support:

```powershell
supabase db dump --linked --data-only --file frettrack-beta-data.sql
```

For smaller support exports, prefer targeted SQL or Table Editor CSV exports over a full dump.

Minimum beta export packet:

- `customers`
- `jobs`
- `job_parts`
- `job_services`
- `work_logs`
- `job_images`
- `customer_messages`
- `job_events`
- `shop_profiles`
- Any relevant `transaction_events` and `payment_events`
- Storage originals from `job-images`
- Storage originals from `shop-assets`

## Recovery Notes

If a tester reports data loss or corruption:

1. Stop writing new test data if possible.
2. Record the tester account, shop ID, approximate time, browser, and last action.
3. Export the affected job JSON if the job still opens.
4. Export the relevant Supabase rows before attempting a fix.
5. Check whether the problem is UI-only by querying the rows directly in Supabase.
6. If database restore is needed, review Supabase backup options before restoring anything.
7. Do not overwrite Storage objects unless the original object has been downloaded or the tester confirms it is disposable.

If login, onboarding, job save, photo upload, cross-shop access, or print output is broken, treat it as a beta blocker.

If the request is dashboard polish, accounting polish, deeper inventory expansion beyond the current purchasing/receiving/landed-cost foundation, SMS/email automation polish, or more reporting, file it as post-beta.

## Known Beta Limitations

- Limited tester access only.
- No public signup.
- Leaked-password protection is pending Supabase Pro upgrade.
- Commerce RPC advisor warning is accepted after isolation abuse testing passed.
- FretTrack is not tax or accounting software.
- Older Supabase schema drift remains under review.
- Bulk export/import tooling is not yet in the app.
- Supabase Storage objects need separate backup/export handling.
- Email/SMS automation polish is post-beta.
- Deeper inventory expansion beyond current parts, vendors, purchase orders, receiving, barcode labels, purchase history, and landed-cost allocation is post-beta.
- Reports beyond current print sheets are post-beta.
