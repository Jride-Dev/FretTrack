# Supabase Migration Workflow

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

## Migration Repair Report - v0.2.61

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
