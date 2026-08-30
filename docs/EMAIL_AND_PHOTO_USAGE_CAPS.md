# Email and Photo Usage Caps

FretTrack 0.3.1 enforces email and repair-photo limits authoritatively on the server. These caps protect infrastructure without deleting customer data, hiding existing photos, or blocking unrelated repair work.

## Official Limits

| Plan context | Transactional email recipients / UTC month | Source-photo uploads / UTC month | Current repair-photo storage |
| --- | ---: | ---: | ---: |
| Shop / Shop trial | 1,000 | 2,000 | 5 GiB (5,368,709,120 bytes) |
| Pro / Pro trial | 5,000 | 10,000 | 25 GiB (26,843,545,600 bytes) |

Legacy `free` and `solo` compatibility rows use Shop-equivalent limits. The internal `enterprise` compatibility row remains above Pro but is not a public tier. Operator overrides may explicitly replace any of the three numeric limits through the existing audited `shop_entitlement_overrides` mechanism. Missing, negative, fractional, or malformed override values fall back safely to the plan default; `null` means no override and zero is an explicit disabled limit.

## Counting Rules

Email usage resets at 00:00 UTC on the first day of each calendar month. Each successful To, CC, and BCC recipient counts once per provider request. Previewing or generating a document does not count. A provider rejection or failed send releases the reservation and does not permanently consume quota.

Photo-upload usage uses the same UTC calendar month. One successful user-initiated source upload counts once. Replacing a photo counts as a new source upload. A failed upload does not count, while deleting a photo does not restore the monthly upload count. Generated edited copies and derivatives do not add to the source-upload counter.

Photo storage is current binary-byte usage and does not reset. It includes originals and derivatives in the shop-owned `job-images` bucketâ€”job photos, Damage Map images, and edited copiesâ€”and inventory images in `part-images`. Successful deletion releases the exact ledgered bytes. Static application assets are never counted. Shop logos in `shop-assets` are excluded because they are account branding rather than repair-related images.

## Server Enforcement

`shop_usage_periods` stores monthly settled recipient and source-upload counts. `shop_photo_storage_totals` stores current bytes. `shop_usage_reservations` provides exact-shop, exact-path, idempotent reservations, and `shop_photo_storage_objects` records authoritative per-object bytes.

Reservation RPCs lock the shop usage rows before checking settled plus active reservations, preventing concurrent requests from crossing a limit. Photo Storage policies require an unexpired reservation for the exact authorized bucket and path. Settlement reads actual bytes from `storage.objects`; clients cannot submit usage totals. Failed operations release reservations. Photo deletion reduces storage only after the Storage API has removed the object.

The `send-email` Edge Function resolves the job's shop and current write access, counts recipients, reserves quota, and only then calls Resend. It settles after provider acceptance or releases after failure. A reached email cap returns `EMAIL_MONTHLY_LIMIT_REACHED` with limit, used, remaining, and reset date without exposing another shop.

## User Experience

Owner/admin Shop Settings shows used, limit, remaining, percentage, and the UTC reset date. Usage is normal below 80%, warning from 80% through 94%, critical from 95% through 99%, and reached at 100%. Text labels accompany color.

At a hard limit, only the affected send or upload is blocked. Existing records and photos remain viewable and downloadable, existing photos may still appear in reports, and deletion remains available to recover storage. Technicians receive concise upload errors without gaining plan or billing access. Viewers gain no write access.

On a Pro-to-Shop downgrade, historical data remains intact. Current monthly counts are not rewritten. Email sends use the active Shop limit, and new uploads remain blocked while current usage is above the Shop cap. Existing expired/read-only lifecycle restrictions continue to take precedence and quota logic never restores write access.

There are no paid overages, Stripe changes, checkout controls, or automatic billing in this foundation. Provider and Supabase limits are infrastructure constraints, not customer allowance promises. A future storage or messaging add-on may be evaluated, but no price or availability is promised.
