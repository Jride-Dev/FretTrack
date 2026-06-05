# Offline Continuity Plan

## Beta 14 Scope

FretTrack beta.14 adds a first safe offline continuity layer for repair intake. The goal is to keep shops moving when the internet or Supabase connection goes down without pretending the whole app is fully offline-capable yet.

What beta.14 supports now:

- browser online/offline detection
- clear offline status messaging in the app shell
- local IndexedDB draft storage for new work orders
- manual review of pending drafts
- manual one-at-a-time sync when the connection returns
- clear failed/pending/synced state per draft

What beta.14 intentionally does not support:

- full offline database behavior
- background auto-sync
- offline editing of existing remote jobs
- offline photo/blob queue
- cached authenticated Supabase API responses
- private customer/job data cached in the service worker

## Storage Approach

Beta.14 uses IndexedDB in the browser for local draft work orders.

Draft records store:

- local draft id
- shop id
- created/updated timestamps
- sync status (`draft`, `pending`, `synced`, `failed`)
- last sync error if present
- new work-order payload data needed to recreate the job remotely later

This keeps the first offline layer local to the signed-in device and avoids introducing a second database or a conflict-prone sync engine.

## New Job Offline Flow

When a new work-order save fails because the browser is offline or the remote save path cannot complete:

1. the new work order is preserved locally in IndexedDB
2. the user sees `Saved locally. Sync when connection returns.`
3. the draft appears in the Local Drafts / Pending Sync panel
4. the draft remains clearly unsynced until a manual sync succeeds

This avoids silent data loss and avoids falsely implying that the job already exists in Supabase.

## Manual Sync

Beta.14 uses manual sync only.

When the shop is online again, the user can:

- open Local Drafts
- review one draft
- sync that draft manually
- discard drafts that should not be kept

We intentionally do not auto-sync everything in the background yet. That keeps the first version safer and easier to reason about, especially around duplicate prevention and partial failures.

## Duplicate and Conflict Policy

Beta.14 only supports offline continuity for brand-new work orders.

- existing remote job edits remain online-only
- conflict handling for edited existing jobs is future work
- retry sync is protected by the existing remote duplicate work-order guard

If a draft sync collides with an already-created remote work order using the same work-order number, the duplicate guard should prevent a second copy from being created.

## Photos

Offline photo queueing is intentionally deferred.

For beta.14:

- new work-order drafts can be saved locally
- photos should be added after the draft syncs remotely

Future work can add:

- queued photo blobs
- post-sync image upload retry
- smarter field-level attachment state

## Service Worker Safety

The service worker remains intentionally conservative.

It should:

- cache app shell/static assets only
- avoid Supabase API response caching
- avoid Resend/email call caching
- avoid authenticated private data caching

Offline continuity in beta.14 comes from IndexedDB draft storage, not from broad response caching.

## Future Phases

Likely beta.15+ candidates:

- queued offline photos
- recently-opened job cache with strict privacy rules
- explicit conflict-resolution UI
- optional last-known read-only job snapshot
- better recovery tooling for interrupted sync attempts

## Important Distinction

Offline drafts are workflow continuity, not disaster recovery.

They help a shop keep taking in work during a connection outage on a specific device. They are not a substitute for:

- Supabase data durability
- exports
- backups
- shop operational recovery planning
