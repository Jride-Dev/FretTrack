# Beta Notes

## Known beta limitations

- Limited tester access only
- No public signup
- Leaked-password protection pending Supabase Pro upgrade
- Commerce RPC advisor warning accepted after isolation abuse test passed
- Not tax/accounting software
- Backups/export warning still applies
- Known issue: older Supabase schema drift remains under review, but current beta-blocking privacy checks passed.
- Backup awareness, export paths, and recovery notes are documented in `docs/BETA_OPERATIONS.md`.

## v0.2.6-beta.2

- Added first-run shop onboarding/profile setup.
- Added post-login shop selection and self-service beta shop creation.
- Added private shop logo storage.
- Print sheets can now use uploaded shop logos.
- Added beta operations notes for backups, exports, recovery, and limitations.
- Added in-app beta announcements for maintenance and bug-fix notices.
- Added in-app Report Issue form backed by Supabase `beta_feedback`.
- Added custom FretTrack domain/email setup notes for branded Supabase Auth invites.
- Added a public coming-soon page at `frettrack-app.com` with a beta login link to `app.frettrack-app.com`.
- Fixed selected-shop job saves that could fail RLS for non-default shops.
- Fixed browser focus/session refresh churn that could reset the open workspace.
- Added explicit password reset/update flow instead of relying on reset links that only establish a session.
- Added a User section in Shop Settings for authenticated password changes.
- Added a default-shop-only PVMH subcontractor pickup email prompt on Finish / Picked Up for eligible Sub-Contract jobs.
- Added per-shop workspace restore for the last open mode/job.
- Fixed damage-map and marker photo reloads by rehydrating saved storage paths.
- Replaced damage-marker new-tab links with inline photo preview, replace, and remove controls.
- Fixed customer damage report print layout so damage maps and work-order photos stay paper-safe.
