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
- Versioned customer synchronization preserves post-parent-save failures for the workspace notice path, while payment autosaves route stale-write conflicts through the same visible error surface.
- `useJobInventoryParts.js` owns manual and inventory-backed job-part search, add, quantity update, removal, and authoritative refresh coordination.
- `foundations.css`, `workspace.css`, and `styles.css` preserve the original stylesheet order while separating shared tokens/controls, workspace surfaces, and remaining feature/detail rules.
- `InventoryPage.jsx` is now a focused composition surface. `useInventoryPageData.js` owns shop-scoped catalog/history loading, `useInventoryPartController.js` owns part, stock, image, and label workflows, and `useInventoryPurchasingController.js` owns vendor and purchase-order workflows.

## Current pressure points

- `App.jsx` still coordinates session/shop bootstrap and non-job domains.
- `JobDetail.jsx` still coordinates work-log, photo, communication, and section composition.
- Inventory display components and service facades remain intentionally stable while the new controller hooks own their mutation domains.
- Remaining source-text checks should become executable behavior checks when deterministic coverage is practical.

Future extraction stays incremental. Compatibility facades, permission rules, optimistic concurrency, persistence order, print behavior, and responsive rendering must remain intact; no broad rewrite or schema change is justified solely for organization.
