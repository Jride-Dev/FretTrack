# FretTrack Architecture Health Audit for 0.3.0

Audit date: July 31, 2026

## Executive summary

FretTrack is functionally healthy and its domain-oriented folder structure is a sound foundation. The application is not a dependency-cycle or "spaghetti" codebase: the JavaScript and JSX module graph contained 150 modules, 378 relative-import edges, and no circular imports at the time of this audit.

The primary architectural concern is that several files have accumulated too many responsibilities. In particular, `src/app/App.jsx` still acts as the application shell, page router, shared data loader, permission coordinator, and job workflow controller. Feature modules therefore exist physically, but some are not yet independent runtime boundaries.

## Validation baseline

The following baseline was green when this audit was recorded:

- All 38 package-level focused regression checks passed.
- The production Vite build passed.
- `git diff --check` passed.
- `npm audit --audit-level=moderate` reported zero vulnerabilities.
- Strict Supabase migration-history validation passed with no remote-only drift.
- The source module graph contained no circular imports.

## Main pressure points

The largest source files were:

| File | Approximate lines | Main concern |
| --- | ---: | --- |
| `src/styles.css` | 5,448 | Global selector collisions and 51 `!important` declarations |
| `src/app/App.jsx` | 1,833 | Application shell, navigation, shared state, and feature orchestration combined |
| `src/modules/inventory/InventoryPage.jsx` | 1,619 | Multiple inventory and purchasing workflows in one page |
| `src/modules/jobs/jobService.js` | 1,604 | Queries, mutations, mapping, events, and workflow logic combined |
| `src/modules/jobs/JobDetail.jsx` | 1,584 | Many job-detail sections and actions coordinated in one component |
| `src/modules/inventory/inventoryService.js` | 1,195 | Broad inventory, PO, and receiving persistence responsibilities |

Other notable findings:

- `App.jsx` had 38 `useState` calls and 11 `useEffect` calls.
- `InventoryPage.jsx` had 29 `useState` calls.
- `JobDetail.jsx` had 18 `useState` calls.
- Job and inventory services contained extensive database mapping and Supabase calls.

These files are not inherently defective, but future changes inside them have an increasing regression radius.

## Regression coverage findings

FretTrack has broad feature-specific validation coverage: 38 `check-*.mjs` files totaling approximately 4,476 lines. The suite contained hundreds of source and runtime assertions.

The main weakness is test style rather than test quantity:

- Many checks inspect source-code text or selector patterns instead of exercising rendered behavior.
- Sixteen checks inspect Git diff or status, which can make otherwise correct checks sensitive to branch and working-tree state.
- There is no conventional component/unit-test runner or browser end-to-end suite.
- There is no ESLint or static type-checking configuration.
- Print checks validate implementation contracts but do not replace real browser/PDF rendering smoke tests.

## Backup reliability blocker

The scheduled hosted Supabase backup failed for at least six consecutive scheduled runs because Docker Desktop was unavailable. A later manual run on July 31 succeeded and produced database, migration-history, role, storage-object, checksum, and comparison artifacts.

Before 0.3.0, unattended backup reliability should be corrected so it does not silently depend on Docker Desktop already running. A restore drill and failure notification should accompany that correction.

## Intended module architecture

Each top-level feature should become a self-contained page boundary that owns its page-specific loading, forms, dialogs, filters, and dirty state. The application shell should remain responsible only for authentication, the selected shop, global navigation, global notices, and application-level access context.

The incremental target is:

1. Extract top-level page selection from `App.jsx` into a workspace router.
2. Extract navigation and dirty-state transitions into a focused workspace-navigation hook.
3. Let individual modules own their domain data through focused hooks and services.
4. Split `JobDetail` and `InventoryPage` into orchestration components plus focused sections.
5. Split broad services into queries, mutations, mapping, and domain-specific operations while retaining compatibility facades during migration.
6. Move global CSS into shared foundations plus module-owned styles without redesigning the interface.
7. Add behavior-based browser smoke coverage for the highest-risk workflows.

## Architecture work started

The first implementation slice is on `refactor/workspace-router-foundation`:

- `WorkspaceRouter.jsx` owns top-level page selection and lazy feature loading.
- `useWorkspaceNavigation.js` owns workspace mode, selected-job state, persisted restoration, access-aware transitions, dirty-state confirmation, and Job Detail return behavior.
- The compact Current Jobs list and full Current Jobs page now share a small domain status helper without importing one page from another.
- `NewJobSidebar.jsx` owns the Job Form, compact Current Jobs, Till Summary, and Upcoming Schedule composition.
- `appAccess.js` owns the derived application permission and entitlement map while continuing to call the centralized permission and billing helpers.
- Inventory History, Barcode Labels, Vendors, the Parts search/list, and the controlled Part editor now have focused presentation boundaries. `InventoryPage.jsx` remains the controller for part/vendor mutations, image handling, stock adjustments, barcode printing, and purchasing state, reducing its size from approximately 1,619 to 1,190 lines without moving transactional behavior.
- Focused regression checks follow the new architecture boundary instead of requiring feature JSX to remain inside `App.jsx`.

An authenticated local navigation smoke test is required before proceeding into deeper component and data-ownership extraction.

The first local smoke test confirmed permission restrictions and Job Detail return behavior. It also exposed a startup hydration race: the initial New Job mode was persisted before asynchronous shop data could restore the saved page. The navigation hook now uses a per-shop hydration barrier, and the focused check executes restoration cases for ordinary pages, valid Job Detail selections, and stale job selections.

## 0.3.0 priorities

1. Fix unattended backup reliability and perform a restore drill.
2. Establish the workspace router boundary without changing behavior.
3. Add a small browser smoke matrix for jobs, documents and measurements, invoices and VAT, inventory receiving, scheduling, and permissions.
4. Make diff-dependent checks deterministic where possible.
5. Add linting, then refactor one pressure point at a time rather than performing a broad rewrite.

## Test-environment decision

The two free hosted Supabase projects are occupied by FretTrack production and Stillwater. FretTrack architectural work will therefore use the local Supabase stack as its isolated development and staging environment.

- Routine validation uses seeded fictional local shops.
- Compatibility checks may restore a hosted backup into the local database.
- Email and SMS must remain disabled or redirected locally.
- Cloudflare preview deployments must not use production Supabase for mutation testing.
- Production deployment follows focused checks, a local production build, and local browser smoke testing.
