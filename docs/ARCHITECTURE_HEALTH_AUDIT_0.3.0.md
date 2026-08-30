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
| `src/app/App.jsx` | 1,738 | Application data orchestration and domain hooks |
| `src/modules/jobs/jobService.js` | 1,661 | Mapping, queries, mutations, and child synchronization |
| `src/modules/jobs/JobDetail.jsx` | 1,385 | Focused state/action hooks and thinner orchestration |
| `src/modules/inventory/inventoryService.js` | 1,286 | Parts, vendors, purchase orders, receiving, and specialist purchasing |
| `src/modules/inventory/InventoryPage.jsx` | 953 | Remaining controller state and mutation coordination |

Inventory presentation was reduced from roughly 1,619 lines to 953. Job Detail presentation was reduced from roughly 1,584 lines to 1,385 while gaining isolated print boundaries and specialist routing. `jobService.js`, `inventoryService.js`, and global CSS grew as product behavior expanded, making them the correct post-release targets.

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
2. Split `jobService.js` behind its current exports. Move pure mapping first, then reads, parent mutations, and child synchronization.
3. Split `inventoryService.js` by parts, vendors, purchasing, receiving, and specialist-bridge operations.
4. Extract domain data hooks from `App.jsx` and action/state hooks from `JobDetail.jsx` one tested slice at a time.
5. Move CSS incrementally into shared foundations and module styles while preserving current rendering and print media behavior.
6. Replace remaining source-text checks with unit, component, database, or browser behavior tests where the behavior can be exercised deterministically.

The release-version bump stays deferred until the maintainability slices are merged and the new boundaries remain green in CI.

The first job-service extraction slice is already in motion behind compatibility exports: job normalization and child synchronization helpers now live in focused modules while the facade remains stable.

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
