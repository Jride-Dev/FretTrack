# Database Backups

FretTrack uses a local Windows/Supabase CLI backup workflow for daily hosted database snapshots and local Docker safety archives.

## Daily Hosted Snapshot

Run:

```powershell
npm run backup:supabase
```

This calls `scripts/backup-hosted-supabase.ps1`.

The script:

- Dumps the linked hosted Supabase project into `backups/hosted-supabase-YYYYMMDD-HHmmss/`.
- Saves `roles.sql`, `schema.sql`, `data.sql`, `migration_history_schema.sql`, and `migration_history_data.sql`.
- Copies the current local `supabase/migrations` and `supabase/functions` folders into the snapshot.
- Writes `manifest.json`, `checksums.sha256`, `row-counts.txt`, `migration-versions.txt`, and `compare-report.md`.
- Compares schema hash, migration history, and dumped table row counts against the previous hosted snapshot.
- Archives the local Docker database volume `supabase_db_FretTrack` into `backups/docker-volume-YYYYMMDD-HHmmss/`.

The scheduled backup does not refresh or overwrite the local database.

## Local Docker Refresh

Run this only when you intentionally want local Docker Supabase to mirror the latest hosted snapshot:

```powershell
npm run db:local:refresh-from-backup
```

This calls `scripts/refresh-local-db-from-hosted-backup.ps1`.

The refresh script:

- Creates a pre-refresh archive of the current `supabase_db_FretTrack` Docker volume.
- Runs `supabase db reset --yes` against the existing local Supabase stack.
- Restores the latest hosted `data.sql` into the local database.
- Preserves Supabase internal migration tables while restoring `public`, `auth`, and `storage` data.
- Prints migration versions and key table row counts after restore.

Do not run the refresh script during active local development unless local database changes are disposable or already backed up.

## Windows Scheduled Task

The daily task is named:

```text
FretTrack Daily Supabase Backup
```

It runs:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File F:\FretTrack\scripts\backup-hosted-supabase.ps1
```

Default schedule:

```text
Daily at 02:30 local time
```

To inspect it:

```powershell
schtasks /Query /TN "FretTrack Daily Supabase Backup" /V /FO LIST
```

To run it manually:

```powershell
schtasks /Run /TN "FretTrack Daily Supabase Backup"
```

## Restore Notes

- Database dumps include `storage.objects` metadata, not the binary contents of Supabase Storage buckets.
- Photo and file binary backup should be added separately before relying on this as full disaster recovery.
- Do not commit backup contents.
- Do not print Supabase connection strings, database passwords, or service role keys in logs.
- The scripts use the existing linked Supabase CLI project and current local Docker stack. They do not run `supabase db push`, deploy Edge Functions, or deploy the frontend.

## Validation

After a backup or refresh, check:

```powershell
npm run check:migrations
npm run build
git diff --check
```

For local restore confidence, also verify:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Status}}"
docker exec supabase_db_FretTrack psql -U postgres -d postgres -c "select version from supabase_migrations.schema_migrations order by version;"
```
