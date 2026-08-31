# FretTrack Roadmap

The current stable release is `v0.3.1`.

## v0.3.0: Operational Shop Release

The Operational Shop Release establishes one dependable intake-to-pickup system for guitar, amplifier, and keyboard repair shops.

Shipped product boundaries include:

- controlled account approval and non-converting 14-day Pro trials;
- Shop and Pro subscriptions through Stripe Checkout and the Billing Portal;
- customers, subcontractors, focused repair benches, work logs, parts, services, payments, and history;
- inventory, vendors, purchase orders, receiving, landed costs, barcode labels, and specialist purchasing;
- scheduling, Current Jobs, assignment, localization, and permission-aware shop settings;
- private photos, Damage Maps, Photo Editor, and isolated customer/job-sheet print documents;
- immediate email, Scheduled Email, service reminders, Message History, and loyalty;
- accounting-safe work-order exclusion and audited refund/payment-void safeguards;
- usage limits, shop isolation, Row Level Security, guarded RPCs, backup automation, and tested restore procedures;
- focused workspace, Inventory, Job Detail, Guitar, Amplifier, Keyboard, and print presentation boundaries;
- pgTAP/RLS, focused regression, production-build, and 29-test Playwright coverage in CI.

Known product boundaries:

- SMS is disabled.
- Existing-job edits do not have full offline synchronization.
- Public invoice and work-order links are not implemented.
- Customer instruments are stored with work orders rather than in an independent asset registry.
- Advanced accounting permissions and locked/finalized totals need deeper design.
- Supplier APIs, carrier labels/rates, vendor returns, forecasting, and automated customer shipping remain future work.
- Paid usage overages and multi-shop subscription administration are not implemented.

## v0.3.1: Maintainability and service boundaries

The first post-release work is deliberate spaghetti reduction without changing product behavior:

1. ESLint baseline is now in place for JavaScript, React hooks, import hygiene, and CI enforcement.
2. Keep the completed `jobService.js` split stable across mapping, queries, mutations, messaging, child synchronization, and compatibility exports.
3. Keep the completed `inventoryService.js` split stable across parts, vendors, purchase orders, receiving, specialist purchasing, and history operations.
4. Continue reducing `App.jsx` and `JobDetail.jsx` orchestration through focused hooks and domain controllers. App preferences, team loading, session/shop bootstrap, and Job Detail derived billing/payment/service state now have focused owners; work-log, photo, and communication coordination is next.
5. Keep the global CSS split into ordered foundations, workspace surfaces, and remaining feature/detail styles, then continue moving rules into module-owned styles without redesigning the interface.
6. Replace remaining source-text and dirty-diff assertions with executable behavior checks where practical.

The first post-release controller slice reduced `InventoryPage.jsx` from 953 lines to a focused composition surface. `useInventoryPageData.js` now owns shop-scoped loading and stale-safe part history, `useInventoryPartController.js` owns parts, stock, images, and barcode-label selection, and `useInventoryPurchasingController.js` owns vendors, purchase orders, status changes, and receiving.

The `0.3.1` version identifies this behavior-preserving maintainability release. Later version bumps remain deferred until each additional extraction slice holds under CI.

The job-service split is complete behind a 21-line compatibility facade. Normalization, queries, mutations, messaging, and child synchronization now have focused owners, and the transitional duplicate implementations have been removed.

The inventory-service split is complete behind its compatibility facade: shared normalization helpers, parts/vendor catalog helpers, purchase-order helpers, receiving/job-part helpers, and inventory history assembly now live in focused modules while existing imports remain intact.

The app-shell extraction now includes access/status panels, pure runtime helpers, offline draft orchestration, stale-safe job/customer loading, permission-aware online work-order actions, and session/shop bootstrap. The remaining `App.jsx` work is limited to smaller cross-domain composition concerns rather than authentication and tenant restoration.

Each extraction must preserve the current facade, permissions, database behavior, and regression suite. No broad rewrite.

## v0.3.x: Commerce hardening

- estimate approval and lifecycle clarity;
- stronger monetary-edit permissions and finalized-total audit behavior;
- invoice and transaction numbering review;
- deeper payment/refund support tooling;
- tax-profile and sales-history improvements;
- public invoice or work-order links only after a secure token and revocation design;
- billing reconciliation and operator support tools.

## v0.4.x: Operations

- reviewed customer import and duplicate resolution;
- customer instrument/asset profiles independent of individual work orders;
- vendor import/export and supplier integrations;
- vendor returns and inventory forecasting;
- outbound/customer shipping, carrier rates, labels, and tracking;
- deeper reminder campaigns and unsubscribe management;
- optional loyalty-to-invoice assistance without treating loyalty as payment or store credit;
- broader document and photo workflows based on shop feedback.

## v0.5.x: Scale and resilience

- multi-shop subscription administration;
- advanced billing support operations;
- recurring restore drills and off-device backup execution;
- deeper monitoring, incident response, and reconciliation;
- stronger offline continuity only after conflict and synchronization behavior is designed explicitly.

## Historical milestones

Earlier `0.2.x` prerelease milestones delivered Customers, Inventory, Scheduling, permissions, trials, photo workflows, specialist repair modules, messaging, billing, recovery, and the architecture foundation that made the stable 0.3.0 release possible. Historical release notes retain their original version labels for auditability; they are not current product branding.
