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
- Copies Supabase Storage bucket files into `storage-buckets/` using the Supabase CLI storage API. The script lists each bucket recursively and downloads objects one by one so the backup does not depend on whole-bucket copy behavior.
- Copies the current local `supabase/migrations` and `supabase/functions` folders into the snapshot.
- Writes `manifest.json`, `checksums.sha256`, `row-counts.txt`, `migration-versions.txt`, and `compare-report.md`.
- Compares schema hash, migration history, and dumped table row counts against the previous hosted snapshot.
- Archives the local Docker database volume `supabase_db_FretTrack` into `backups/docker-volume-YYYYMMDD-HHmmss/`.
- Writes a transcript log under `backups/logs/`.

The scheduled backup does not refresh or overwrite the local database. It creates a hosted database/storage snapshot and a local Docker volume archive. Local Docker refresh remains an intentional manual restore step.

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
Daily at 02:00 local time
```

The task runs under the current Windows user account and uses that user's Supabase CLI login/profile plus local Docker access. The PC must be awake with the user signed in or locked, network access available, and Docker Desktop available for the local volume archive.

Register or repair the task with:

```powershell
npm run backup:register-task
```

To inspect it:

```powershell
schtasks /Query /TN "FretTrack Daily Supabase Backup" /V /FO LIST
```

To run it manually:

```powershell
schtasks /Run /TN "FretTrack Daily Supabase Backup"
```

The task should use `F:\FretTrack` as its working directory and should run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File F:\FretTrack\scripts\backup-hosted-supabase.ps1
```

If a run fails, check the newest transcript in:

```text
backups/logs/
```

and look for `FAILED.txt` in the incomplete snapshot folder.

Latest manual scheduled-task verification: `2026-06-26 02:58`, result `0`, snapshot `backups/hosted-supabase-20260626-025825`, Docker archive `backups/docker-volume-20260626-025825/supabase_db_FretTrack.tar.gz`.

## Restore Notes

- Database dumps include `storage.objects` metadata.
- Storage bucket binaries are copied under each snapshot's `storage-buckets/` folder.
- The Supabase CLI storage commands are still marked experimental, so periodically verify photo/file restore paths before relying on this as full disaster recovery.
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
