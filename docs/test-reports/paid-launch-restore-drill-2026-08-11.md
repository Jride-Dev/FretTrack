# Paid-Launch Local Restore Drill — 2026-08-11

## Scope

- Source snapshot: `backups/hosted-supabase-20260811-182456`
- Target: local Supabase only
- Production database, Storage, Edge Functions, and deployment were not modified.
- Pre-refresh archives were created for both `supabase_db_FretTrack` and `supabase_storage_FretTrack` before each destructive local reset.

## Compatibility Findings

- The first import exposed stale local service pins: Auth `v2.189.0` and Storage `v1.60.10` did not match linked Auth `v2.195.0` and Storage `v1.68.11`.
- Refreshing the existing Supabase link updated the local pins and allowed the hosted Auth data to import.
- Storage SQL metadata already contained the object keys, so binary recovery uses authenticated local Storage API upserts.
- Historical bucket restrictions blocked a grandfathered 3.1 MiB job image during ordinary upload. The restore now snapshots and temporarily relaxes only the local bucket limits, uploads the historical objects, and restores the exact original limits afterward.
- Portable ownership, timestamps, and object metadata are restored. The environment-specific local object version is retained so the restored binaries remain addressable.

## Results

- Repository migrations applied locally: 58 of 58.
- Local and linked migration histories aligned through `20260811200225`.
- After the focused security follow-up, local migration history contains 59 migrations through `20260812025459`; that migration remains intentionally pending on the linked project.
- Backed-up table counts compared: 73.
- Table-count mismatches: 0.
- `node scripts/check-supabase-data-integrity.mjs --local`: passed.
- Storage metadata rows: 194.
- Storage objects downloaded from the restored local API: 194.
- Missing/unavailable Storage objects: 0.
- Storage SHA-256 mismatches against the snapshot: 0.
- Production deployment preflight: passed; deployment was explicitly skipped.
- Follow-up migration `20260812025459_harden_set_updated_at_search_path.sql` applied locally; trigger behavior passed and the local Supabase Security Advisor returned no warnings.

## Remaining Recovery Gate

The restore baseline is proven. Paid launch still requires three consecutive successful unattended daily backup runs, or migration of that task to a reliable always-on runner.
