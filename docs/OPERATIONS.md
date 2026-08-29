# FretTrack Operations

This runbook covers production data protection, exports, recovery, and incident handling for the stable FretTrack service.

## Backups

Daily hosted snapshots are created by `scripts/backup-hosted-supabase.ps1` through the `FretTrack Daily Supabase Backup` Windows Scheduled Task. Each complete snapshot includes database dumps, migration history, function sources, row counts, checksums, a comparison report, and downloaded Storage objects. Database backups alone do not contain the underlying Storage binaries.

Run a manual full snapshot with:

```powershell
npm run backup:supabase
```

Repair or register the scheduled task with:

```powershell
npm run backup:register-task
```

Treat a snapshot as recoverable only when its completion metadata validates and it contains no `FAILED.txt`. See [Database Backups](DATABASE_BACKUPS.md) for the complete backup and restore contract.

## Export paths

- Single work order: use **Export Job JSON** from Job Detail.
- Shop data: use reviewed, shop-scoped SQL or Table Editor exports for customers, jobs, parts, services, work logs, images, messages, events, payments, and shop settings.
- Storage: download `job-images`, `shop-assets`, and other applicable private bucket objects separately from database exports.

Never publish production exports or commit backup contents.

## Recovery

If data loss or corruption is suspected:

1. Stop avoidable writes to the affected shop.
2. Record the shop, user, work order, time, browser, and last action.
3. Export the affected record before attempting a repair.
4. Determine whether the problem is display-only or exists in persisted data.
5. Select the newest validated complete snapshot, never merely the newest folder.
6. Restore into local Supabase first with `npm run db:local:refresh-from-backup`.
7. Compare row counts, migration history, Storage checksums, and application integrity before considering any hosted recovery.
8. Obtain explicit approval before applying a restore or migration remotely.

## Release and incident checks

- Login, onboarding, job save, billing persistence, photo upload, cross-shop isolation, subscription access, and print output are release-critical.
- Check official Cloudflare and Supabase status before treating a provider outage as an application defect.
- Use the in-app system notice path for planned maintenance or confirmed incidents.
- Keep the last known-good Cloudflare deployment URL and latest validated backup available for rollback decisions.

## Current limitations

- SMS is disabled.
- Existing-job edits do not have full offline synchronization.
- FretTrack is not accounting, tax, or legal software.
- Supabase leaked-password protection depends on the project plan and should be rechecked whenever the project plan changes.
