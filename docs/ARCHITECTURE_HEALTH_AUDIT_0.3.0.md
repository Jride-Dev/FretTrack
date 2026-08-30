# FretTrack Architecture Health Audit for 0.3.0

Status updated: August 28, 2026

## Release conclusion

FretTrack is functionally and operationally ready for the stable 0.3.0 release once the coordinated release checks pass. The application is not blocked by dependency cycles or a required rewrite. Its principal maintainability risk is concentration of orchestration, persistence, and global styling in several large files.

The 0.3.0 work deliberately established safe presentation and routing boundaries before attempting data-service decomposition. That reduced regression radius around workspace navigation, Inventory, Job Detail, specialist repair benches, and printing without changing the database contracts beneath them.

## Original 0.3.0 priorities

| Priority | Status | Evidence |
| --- | --- | --- |
| Fix unattended backup reliability and perform a restore drill | Complete | The backup task starts and waits for Docker, three consecutive unattended runs were recorded, and the hosted-to-local database plus Storage restore drill passed. |
| Establish the workspace router boundary | Complete | `WorkspaceRouter.jsx`, `useWorkspaceNavigation.js`, persisted restoration, lazy page loading, and shared specialist navigation are shipped. |
| Add browser smoke coverage | Complete | CI runs 29 Playwright tests across public print documents, authenticated US/UK shops, Shop/Pro gates, Guitar, Amplifier, Keyboard, work notes, and Scheduled Email. |
| Reduce diff-dependent checks | In progress, not a release blocker | Executable Node and Playwright regressions now cover high-risk behavior; some older source and scope checks remain. |
| Add linting | Complete | `eslint.config.js`, a reviewed baseline, and CI enforcement are now in place for the JavaScript app and maintainer scripts. |

## Current pressure points

Approximate release-branch sizes:

| File | Lines | Next boundary |
| --- | ---: | --- |
| `src/styles.css` | 6,446 | Shared foundations plus module-owned styles |
| `src/app/App.jsx` | 1,355 | Remaining application data and mutation orchestration |
| `src/modules/jobs/jobService.js` | 21 | Compatibility facade over focused job-service modules |
| `src/modules/jobs/JobDetail.jsx` | 1,142 | Focused state/action hooks and thinner orchestration |
| `src/modules/inventory/inventoryService.js` | 149 | Compatibility facade over focused inventory services |
| `src/modules/inventory/InventoryPage.jsx` | 953 | Remaining controller state and mutation coordination |

Inventory presentation was reduced from roughly 1,619 lines to 953. Job Detail presentation was reduced from roughly 1,584 lines to 1,142 while gaining isolated print boundaries and specialist routing. The inventory service is now a 149-line compatibility facade over focused catalog, purchasing, receiving, and history modules. The job service is now a 21-line compatibility facade over focused normalization, query, mutation, messaging, and child-persistence modules. `App.jsx`, `JobDetail.jsx`, and global CSS are the next concentration points.

## Shipped boundaries

- top-level workspace router and navigation hook;
- centralized app permission/entitlement derivation;
- focused New Job sidebar and Current Jobs surfaces;
- focused Inventory parts, vendors, labels, purchase orders, receiving, and history components;
- focused Job Detail header, dialogs, shell, Intake, Inspection, Work, Billing, Photos, Messages, Scheduling, Timeline, and Print composition;
- pure job formatting and patch builders with executable checks;
- focused Guitar, Amplifier, and Keyboard benches connected to one shared commercial workspace;
- isolated Customer Service and Condition Report and invoice-style Job Sheet renderers;
- coordinated print request arbitration and image-failure handling;
- local-development hosted-mutation guard and fictional multi-shop fixtures;
- pgTAP/RLS and Playwright CI coverage.

## 0.3.1 maintainability sequence

1. ESLint baseline is established with JavaScript, React, React Hooks, and import rules. Keep the baseline narrow while the first extraction slices land.
2. Keep the completed `jobService.js` split stable behind its existing exports and focused normalization, query, mutation, messaging, and child-synchronization modules.
3. Keep the completed `inventoryService.js` split stable behind its existing exports and focused catalog, purchasing, receiving, history, and normalization modules.
4. Extract domain data hooks from `App.jsx` and action/state hooks from `JobDetail.jsx` one tested slice at a time.
5. Move CSS incrementally into shared foundations and module styles while preserving current rendering and print media behavior.
6. Replace remaining source-text checks with unit, component, database, or browser behavior tests where the behavior can be exercised deterministically.

The release-version bump stays deferred until the maintainability slices are merged and the new boundaries remain green in CI.

The job-service extraction is complete behind a 21-line compatibility facade. `jobServiceQueries.js` owns local persistence, remote loading, merge/hydration, and job-number lookup; `jobServiceMutations.js` owns create, update, status, exclusion, and delete operations; `jobServiceMessaging.js` owns message history and customer-message actions; and the focused normalization and child modules remain the sole source for mapping, persistence sanitization, and guarded child writes.

The inventory-service extraction is complete behind compatibility exports: inventory normalization helpers, parts/vendor catalog helpers, purchase-order helpers, receiving/job-part helpers, and inventory history assembly now live in focused modules while the facade remains stable.

The first `App.jsx` extractions are complete: access/status panels and pure runtime helpers now live in `AppAccessPanels.jsx` and `appRuntimeHelpers.js`, while offline connectivity, local-draft loading, sync, retry, duplicate recovery, and discard behavior live in `useOfflineDraftQueue.js`. The app shell is smaller while retaining its existing permission, billing, shop-selection, and offline-intake behavior.

The compatibility facades stay in place during extraction. No broad rewrite, no schema change solely for code organization, and no mixing behavioral feature work into structural PRs.

## Release validation baseline

The 0.3.0 release gate requires:

- GitHub regression/build and dependency-audit checks;
- local Supabase pgTAP/RLS coverage;
- all 29 Playwright tests;
- migration-history alignment;
- stable-version and customer-facing-copy checks;
- production bundle and production-configuration validation;
- clean diffs and an ITO-cleared release PR;
- app and public-site production verification before the `v0.3.0` tag and GitHub release are published.
