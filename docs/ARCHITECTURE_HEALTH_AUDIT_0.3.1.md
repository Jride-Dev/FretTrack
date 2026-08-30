# FretTrack Architecture Health Audit for 0.3.1

Status updated: August 30, 2026

## Release conclusion

FretTrack 0.3.1 is a behavior-preserving maintainability release over the operational 0.3.0 product. It changes no database schema, plan entitlement, Stripe lifecycle, repair workflow, or public pricing contract.

The completed job and inventory service facades remain stable. This release continues the same boundary-first cleanup by moving application preferences and team-member loading out of `App.jsx`, moving derived job values and billing/inventory actions out of `JobDetail.jsx`, and splitting the global stylesheet without reordering its cascade.

## Completed 0.3.1 boundaries

- `useAppPreferences.js` owns theme persistence, PWA installation state, install-help dismissal, and New Job sidebar persistence.
- `useAssignableMembers.js` owns stale-safe shop team loading and error/loading state.
- `useJobDetailDerivedState.js` owns totals, tax/localization context, measurement options, image selection, and other derived Job Detail values.
- `useJobDetailBillingActions.js` owns service/payment drafts, payment autosave timing, and billing action builders.
- `useJobInventoryParts.js` owns manual and inventory-backed job-part search, add, quantity update, removal, and authoritative refresh coordination.
- `foundations.css`, `workspace.css`, and `styles.css` preserve the original stylesheet order while separating shared tokens/controls, workspace surfaces, and remaining feature/detail rules.

## Current pressure points

- `App.jsx` still coordinates session/shop bootstrap and non-job domains.
- `JobDetail.jsx` still coordinates work-log, photo, communication, and section composition.
- `InventoryPage.jsx` remains a large controller despite its focused presentation and service boundaries.
- Remaining source-text checks should become executable behavior checks when deterministic coverage is practical.

Future extraction stays incremental. Compatibility facades, permission rules, optimistic concurrency, persistence order, print behavior, and responsive rendering must remain intact; no broad rewrite or schema change is justified solely for organization.
