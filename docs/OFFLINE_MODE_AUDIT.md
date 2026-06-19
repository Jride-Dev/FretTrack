# Offline Mode Audit

Current audited version: `0.2.8-beta.0`

## Current Scope

FretTrack currently supports offline continuity for new job intake drafts only. This is a safety net for a shop that starts a new work order while the browser is offline or while the Supabase save path is unavailable.

This is not full offline mode.

## What Works Offline

- Browser online/offline detection updates the app shell.
- New job intake saves can fall back to a local draft when the remote save cannot complete.
- Local drafts are stored per shop and per browser device.
- The Local Drafts screen can review pending drafts.
- A shop user with write access can manually sync one draft at a time after reconnecting.
- Failed sync attempts keep the draft and show the last error.
- Duplicate work-order protection is checked during manual sync so retrying does not intentionally create a second copy.

## What Does Not Work Offline

The following workflows require an active connection:

- Editing existing saved jobs.
- Uploading or deleting job photos.
- Queued photo uploads or offline photo blobs.
- Inventory receiving.
- Manual stock adjustments.
- Purchase orders.
- Purchase order receiving.
- Vendor updates.
- Existing customer edits.
- Scheduling changes.
- Email sending.
- SMS sending.
- Advanced reporting queries.
- Broad authenticated Supabase data sync.

Inventory receiving should not be added to offline mode until conflict handling and idempotent mutation safeguards exist.

## Where Offline Data Is Stored

New-job drafts are stored in browser IndexedDB:

- database: `frettrack-offline-drafts`
- object store: `job-drafts`

Draft records include:

- local draft id
- shop id
- draft status
- created and updated timestamps
- last sync attempt timestamp
- last sync error
- whether photos need to be added after sync
- the new job payload needed for remote creation

The data is local to the browser profile and device. It is not a Supabase backup and it is not shared across devices.

## Browser Refresh Behavior

Refreshing the browser does not remove IndexedDB drafts. When the user signs back in and the same shop is active, FretTrack reloads local drafts for that shop into the Local Drafts screen.

Local drafts can still be lost if the user clears browser site data, uses a private browsing session that discards storage, changes devices, or the browser evicts local storage.

## Reconnect Behavior

When the network comes back, FretTrack does not auto-sync drafts. The user must open Local Drafts and choose Sync Draft manually.

Manual sync:

1. Marks the draft pending.
2. Attempts to create the remote job.
3. Deletes the local draft only after the remote save succeeds or after a duplicate remote job is confirmed.
4. Marks the draft failed and keeps it local if the save fails.

This conservative flow keeps partial failures visible and avoids background writes that are hard to audit.

## Safe Offline Use

Users can safely use offline draft mode for basic new job intake when the connection is down.

Recommended offline workflow:

1. Start a new job.
2. Fill in the intake fields that are available in the New Job form.
3. Save the job as a local draft if the connection is unavailable.
4. Reconnect.
5. Open Local Drafts.
6. Review and sync the draft.
7. Add photos, inventory items, purchase-order details, and follow-up edits after the job exists remotely.

## What Users Should Avoid Offline

Users should avoid treating offline draft mode as a replacement for the live shop database.

Do not rely on offline mode for:

- receiving stock
- adjusting inventory
- creating or receiving purchase orders
- uploading job photos
- editing already-saved jobs
- taking payments
- sending customer emails
- cross-device handoff
- long-term storage

## Known Risks

- Drafts are local to one browser profile and device.
- Clearing site data removes local drafts.
- Private browsing modes may discard drafts.
- If the job-number sequence changes while offline, sync may hit duplicate protection and require review.
- The draft payload can become stale if related customer/shop data changes before sync.
- There is no background retry queue.
- There is no photo upload queue.
- There is no inventory conflict handling.
- There is no server-side offline outbox yet.

## Future Offline Roadmap

A broader offline system should be designed around explicit sync architecture, not one-off local writes.

Future full offline work should include:

- offline outbox
- idempotency keys for every mutation
- server-side conflict detection
- field-level or record-level conflict resolution UI
- sync status per pending mutation
- retry queue with visible failures
- photo upload queue with post-sync attachment repair
- inventory mutation safeguards
- stock receiving conflict handling
- audit logging for every synced mutation
- remote duplicate detection by stable client mutation id
- clear admin tools for stuck local or remote sync states

Inventory receiving should remain online-only until the outbox, idempotency, conflict detection, and audit trail exist. Receiving stock changes quantity on hand, average cost, purchase order received quantities, receipt history, and `part_movements`; those writes must stay transactional and conflict-aware.