# FretTrack Architecture Health Audit for 0.3.0

Audit date: July 31, 2026

## Executive summary

FretTrack is functionally healthy and its domain-oriented folder structure is a sound foundation. The application is not a dependency-cycle or "spaghetti" codebase: the JavaScript and JSX module graph contained 150 modules, 378 relative-import edges, and no circular imports at the time of this audit.

The primary architectural concern is that several files have accumulated too many responsibilities. In particular, `src/app/App.jsx` still acts as the application shell, page router, shared data loader, permission coordinator, and job workflow controller. Feature modules therefore exist physically, but some are not yet independent runtime boundaries.

## Validation baseline

The following baseline was green when this audit was recorded; the beta.4 checkpoint later expanded the configured suite to 40 checks:

- All 39 package-level focused regression checks passed.
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

FretTrack has broad feature-specific validation coverage: 39 `check-*.mjs` files totaling more than 4,500 lines. The suite contains hundreds of source and runtime assertions.

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
- Inventory History, Barcode Labels, Vendors, the Parts search/list, the controlled Part editor, the Purchase Orders list, and the controlled PO creation/receiving editor now have focused presentation boundaries. Pure PO snapshot totals also live outside the page. `InventoryPage.jsx` remains the controller for part/vendor mutations, image handling, stock adjustments, barcode printing, PO creation/receiving, and purchasing state, reducing its size from approximately 1,619 to 945 lines without moving transactional behavior.
- `JobDetailHeader.jsx` now owns status, assignment, and unsaved-state presentation, while `JobDetailDialogs.jsx` owns document email, subcontractor pickup, and photo-editor modal composition. Their existing handlers and all persistence remain in `JobDetail.jsx`.
- `JobDetailShell.jsx` now owns Job Detail's outer presentation shell, dialog/header placement, and tab composition while receiving all sections, handlers, permissions, and dirty/save state from Job Detail.
- Pure Job Detail instrument-selection, measurement-export, and report-marker formatting now lives in `jobDetailFormatting.js` with executable regression cases for custom instrument values, metric measurements, and marker severity colors.
- Pure Job Detail patch builders for customer names, received-date job numbers, brand/model compatibility, instrument/string-count changes, and job/shop tax-rate source metadata also live in `jobDetailFormatting.js`; Job Detail continues to own permission checks, dirty state, and persistence.
- Pure Job Detail payment add/update/remove builders also live in `jobDetailFormatting.js`; Job Detail continues to own payment autosave timing, dirty state, permission checks, and persistence.
- Pure Job Detail neck-inspection and string-gauge patch builders also live in `jobDetailFormatting.js`; Job Detail continues to own shop measurement-unit selection, permission checks, dirty state, and persistence.
- Pure Job Detail manual part and service line-item patch builders also live in `jobDetailFormatting.js`; Job Detail continues to own inventory-backed stock calls, included-service part tracking, permission checks, dirty state, and persistence.
- Pure Job Detail discount, generic tech-field, work-order image selection, contact preference, and message-template patch builders also live in `jobDetailFormatting.js`; Job Detail continues to own controlled UI handlers, permission checks, dirty state, and persistence.
- Pure Job Detail work-log row edits/removals, Damage Map updates, message merges, and assignment-field merges now live in helper boundaries; Job Detail continues to own service calls, save timing, notices, permissions, timeline refreshes, and persistence.
- Pure Job Detail inventory-backed part result merges and local photo preview/remove transforms now live in `jobDetailFormatting.js`; Job Detail continues to own inventory service calls, photo persistence calls, permission checks, stock updates, refreshes, and persistence.
- Pure Job Detail picked-up status patching and Damage Map uploaded-image selection now live in `jobDetailFormatting.js`; Job Detail continues to own the finish flow, PVMH pickup prompt, upload handling, permissions, and persistence.
- Customer-report Damage Map presentation now lives in `JobDamageReportView.jsx`; marker edits and image persistence remain in Job Detail. Together these initial boundaries reduce `JobDetail.jsx` from approximately 1,584 to 1,462 lines.
- `JobPrintDocuments.jsx` now composes the Job Sheet and Customer Damage Report, including the extracted Damage Map renderer. Print commands, document-email generation, measurement settings, totals, and job persistence remain controlled by Job Detail and their established helpers.
- `JobPrintSections.jsx` now owns Job Detail's print-action and print-document composition while retaining the existing Close Detail, finish, export, email, print, measurement, totals, and work-order image handlers supplied by Job Detail.
- `JobInspectionSections.jsx` now composes technical measurements and the Damage Map as a controlled Inspection-tab boundary. It introduces no state or persistence; Job Detail continues to supply shop units, permissions, mutations, and upload handlers.
- `JobWorkSections.jsx` now composes the Work Log and service-line editor as a controlled Work-tab boundary. Work-log and service state, persistence, and permission decisions remain in Job Detail and the existing child components.
- `JobBillingSections.jsx` now composes Parts, Services, and Totals/Payments as a controlled Parts & Billing boundary. Inventory operations, tax/VAT resolution, payment mutation, invoice email, calculations, and persistence remain owned by Job Detail and established domain helpers.
- `JobIntakeSections.jsx`, `JobPhotoSections.jsx`, and `JobAuxiliarySections.jsx` now own Job Detail's Intake, Photos, Messages, Scheduling, and Timeline composition. Contact preferences, instrument/string handlers, photo actions, message sending, linked schedule-event operations, timeline loading, notices, and permission decisions remain owned by Job Detail or their established child modules.
- Focused regression checks follow the new architecture boundary instead of requiring feature JSX to remain inside `App.jsx`.

Authenticated local smoke testing now covers navigation restoration, read-only restrictions, Job Detail tabs, Inventory edits, direct receiving, stock adjustments, and partial/full purchase-order receiving. Deeper component and data-ownership extraction should continue behind the same checkpoint discipline.

Live-data integrity checks now include a read-only Supabase audit for deleted-job orphans, ownerless shop profiles, broken shop-member auth links, and auth users without identities. This should be run during deployment/smoke windows when access issues could be caused by live data drift rather than frontend code.

The first local smoke test confirmed permission restrictions and Job Detail return behavior. It also exposed a startup hydration race: the initial New Job mode was persisted before asynchronous shop data could restore the saved page. The navigation hook now uses a per-shop hydration barrier, and the focused check executes restoration cases for ordinary pages, valid Job Detail selections, and stale job selections.

Later smoke testing exposed stale Inventory editor stock after a successful receive or adjustment. The controller now refreshes authoritative quantity and cost fields after all three stock mutation paths while preserving unrelated unsaved form edits. Local testing also revealed that an ordinary Vite session could inherit the hosted Supabase URL; beta.4 adds a development startup guard and complete fictional local auth/shop seed records so this cannot happen silently again.

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
