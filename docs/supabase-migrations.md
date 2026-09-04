# Supabase Migration Workflow

Current release: **FretTrack 0.3.1**. Migration summaries below describe what each change introduced; remote state is authoritative only after `npm run check:migrations` and the strict remote-history comparison pass.

`20260829071930_access_application_side_effect_idempotency.sql` returns the stable access-request UUID from the public intake RPC, preserves the original request timestamp on retries, and avoids appending identical notes. The landing Worker uses that identity for provider and private-archive idempotency.

`20260903123712_invoice_transaction_numbering_review.sql` adds shop-scoped invoice numbers assigned on first invoice finalization, preserves them across invoice revisions, rejects direct number edits, and requires transaction-event callers to replay a stable `request_id` after an ambiguous response without allocating another event number.

Run this before creating, editing, or applying Supabase migrations:

```powershell
npm run migration:check
```

The check fails when the remote database has migration versions that are missing from `supabase/migrations`. That state blocks `supabase db push` and usually means a migration was applied remotely, then renamed, squashed, deleted, or edited locally after the fact.

## Rules

- Treat applied migration files as immutable.
- Create a new migration for every follow-up database change.
- Do not edit a migration after it has been applied to the remote database.
- Do not delete or squash migration files that exist in remote history.
- If the remote history and local files disagree, recover the missing local migration files before pushing anything new.

## Current Baseline Note

The auth/shop-membership work was applied remotely as three migrations:

```text
20260513055709_add_auth_shop_memberships.sql
20260513062440_fix_child_record_shop_access_rls.sql
20260513063806_prevent_duplicate_work_order_creation.sql
```

The repo briefly had those changes represented as one later edited local migration. That caused remote-only migration drift. The local migration folder now mirrors the remote history again.

## Migration Repair Report - v0.2.6-beta.1

Date: 2026-05-14

### Remote-only migrations found

These versions existed in `supabase_migrations.schema_migrations` on the remote project but were missing from `supabase/migrations` locally:

```text
20260513055709 add_auth_shop_memberships
20260513062440 fix_child_record_shop_access_rls
20260513063806 prevent_duplicate_work_order_creation
```

Classification:

| Version | Status | Notes |
| --- | --- | --- |
| `20260513055709` | Recreated locally | Real applied auth/shop-membership migration. Already reflected in the remote schema. |
| `20260513062440` | Recreated locally | Real applied child-record RLS fix. Already reflected in the remote schema. |
| `20260513063806` | Recreated locally | Real applied duplicate work-order prevention function update. Already reflected in the remote schema. |

None of the remote-only migrations were treated as obsolete or reverted.

### Local-only migrations found

These versions existed locally but were not present in remote history at the time of repair:

```text
20260512083351 commerce_backbone
20260513043535 add_auth_shop_memberships
20260514032803 customer_module_option_b
```

Classification:

| Version | Status | Notes |
| --- | --- | --- |
| `20260512083351` | Still pending | Local commerce-backbone migration. Not applied remotely yet. |
| `20260513043535` | Removed locally | Local-only combined auth migration that duplicated the three real remote auth/RLS migrations. |
| `20260514032803` | Still pending | Customer module Option B migration. Not applied remotely yet. |

### Repair commands run

No `supabase migration repair` command was run.

Instead, the safe repair was done by recovering the missing local migration files so local history matches real remote history:

```text
Created supabase/migrations/20260513055709_add_auth_shop_memberships.sql
Created supabase/migrations/20260513062440_fix_child_record_shop_access_rls.sql
Created supabase/migrations/20260513063806_prevent_duplicate_work_order_creation.sql
Deleted supabase/migrations/20260513043535_add_auth_shop_memberships.sql
```

Remote history was inspected with:

```powershell
npx supabase migration list
```

and by querying:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

### Current db push status

`db push` does not currently pass.

The migration-history mismatch was resolved, but Supabase CLI push/dry-run is currently blocked by the Supabase pooler circuit breaker:

```text
FATAL: Circuit breaker open: Too many authentication errors
```

This happened even when setting `SUPABASE_DB_PASSWORD` from the local `DATABASE_URL`. Once the pooler auth lockout clears or credentials are refreshed, rerun:

```powershell
npm run migration:check
npx supabase db push --dry-run
```

Expected remaining pending local migrations after the pooler issue clears:

```text
20260512083351 commerce_backbone
20260514032803 customer_module_option_b
20260514035528 shop_scope_rls_audit
```

Latest check:

```powershell
npm run check:migrations
```

Result:

```text
Supabase migration history has no remote-only drift.
Pending local migrations:
- 20260512083351
- 20260514032803
- 20260514035528
```

### Drift guard added

Added:

```text
scripts/check-supabase-migrations.mjs
```

New npm scripts:

```powershell
npm run check:migrations
npm run migration:check
npm run migration:check:strict
```

`check:migrations` and `migration:check` both fail when the remote database has migration versions that are missing locally. This catches the dangerous drift state before future pushes.

`migration:check:strict` also fails when local migrations are pending remotely, useful before release or deploy steps.
# Localization migration

`20260727103658_add_shop_country_localization.sql` adds the shop-scoped `country_code` field, permits CAD in the existing currency constraint/catalog, and bounds the existing default tax-rate column to 0–100. It reuses existing `shop_profiles` RLS and is part of the deployed 0.3.0 schema baseline.

# Pro Team Assignment migration

`20260727151302_pro_team_assignment_foundation.sql` adds nullable job-to-membership assignment fields, a partial shop/assignee index, same-shop active-member and role validation, targeted stale-aware assignment and safe member-list RPCs, assignment audit events, Pro and legacy-access entitlement handling, and assignment-aware job creation. It preserves existing jobs as unassigned and does not rewrite job rows. It is part of the deployed 0.3.0 schema baseline.

# Email and Photo Usage Caps migration

`20260727231401_email_photo_usage_caps_foundation.sql` seeds the official Shop/Pro email, source-photo upload, and repair-photo storage limits; adds monthly usage, reservation, current-storage, and per-object ledger tables; adds atomic idempotent reserve/settle/release RPCs and a shop-scoped usage snapshot; backfills known `job-images` and `part-images` objects; and requires exact-path reservations in Storage upload/update policies. It is part of the deployed 0.3.0 schema baseline and does not add paid-overage behavior.

`20260816004706_harden_email_provider_consistency.sql` adds durable email request and quota IDs, a scheduled-operation fingerprint, provider reconciliation metadata, and explicit `pending`/`canceling` states. Unique partial indexes prevent retry-history duplication and concurrent identical schedules, while tightened message policies keep those provider-owned fields unavailable to authenticated clients. Apply it before deploying the matching `send-email` function and app build.

# Estimate lifecycle migration

`20260831220418_job_estimate_approval_lifecycle.sql` is retained for historical estimate fields and compatibility. Estimates are now informational documents selected from the work-order Document Type dropdown; the follow-up migration `20260904020500_estimates_are_informational_documents.sql` removes charge locking and invoice-approval gating while preserving existing history.

`20260903071814_public_estimate_approval_links.sql` adds hashed, private bearer tokens bound to one estimate revision. Owner/admin creation revokes the prior active link and limits expiry to 90 days; anonymous reads expose only the estimate document and shop contact fields. Existing approval-link RPCs remain for compatibility, but customer approval is not required for shop work or invoice finalization.

Estimate email retry hardening is application-level and uses the existing `send-email` request identity; it does not require a new migration. The document dialog retains the same request ID for retryable provider-confirmation failures so the existing Message History claim and provider idempotency key can reconcile one delivery.

# Shop tax profile boundary migration

`20260901025709_shop_tax_profile_boundary.sql` adds an explicit disabled/manual tax-calculation mode and stable versioned default profile to each shop. It synchronizes shop defaults into the shop-scoped `tax_profiles` record, preserves existing configured rates as manual only when the legacy profile also has a jurisdiction, and leaves incomplete legacy defaults disabled for owner review. It upgrades server-calculated estimate/invoice snapshots with tax profile identity, revision, rate source, jurisdiction, registration reference, taxable categories, and proportional invoice-discount allocation. Disabled mode is the safe default and calculates no tax for new work orders.

# Specialist package price persistence migration

`20260901080734_preserve_specialist_package_price.sql` replaces the guarded specialist purchase-order RPC without changing its signature or grants. Newly created pack, box, set, and other packaged inventory parts now retain the exact whole-package vendor price in `parts.purchase_unit_cost` while keeping `parts.unit_cost` as the separately rounded per-item inventory valuation. Existing-part selection and legacy reconstruction remain application concerns.
