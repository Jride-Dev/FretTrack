# FretTrack Roadmap

The current stable release is `v0.3.1`.

## v0.3.0: Operational Shop Release

The Operational Shop Release establishes one dependable intake-to-pickup system for guitar, amplifier, and keyboard repair shops.

Shipped product boundaries include:

- self-service email-confirmed registration and non-converting 14-day Pro trials;
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
- Customer correspondence now has a focused customer Conversation view and an Unassigned Inbox with read-state, deliberate routing, explicit report-selection controls, and selected-message Customer Service Report output. The first inbound provider boundary (signed, replay-safe Resend email ingress) is implemented behind explicitly provisioned shop routes; SMS and Realtime remain future work.
- Supplier APIs, carrier labels/rates, vendor returns, forecasting, and automated customer shipping remain future work.
- Paid usage overages and multi-shop subscription administration are not implemented.

## v0.3.1: Maintainability and service boundaries

The first post-release work is deliberate spaghetti reduction without changing product behavior:

1. ESLint baseline is now in place for JavaScript, React hooks, import hygiene, and CI enforcement.
2. Keep the completed `jobService.js` split stable across mapping, queries, mutations, messaging, child synchronization, and compatibility exports.
3. Keep the completed `inventoryService.js` split stable across parts, vendors, purchase orders, receiving, specialist purchasing, and history operations.
4. Continue reducing `App.jsx` and `JobDetail.jsx` orchestration through focused hooks and domain controllers. App preferences, team loading, session/shop bootstrap, and Job Detail billing, inventory, Work Note, photo, and communication coordination now have focused owners.
5. Keep the global CSS split into ordered foundations, workspace surfaces, and remaining feature/detail styles, then continue moving rules into module-owned styles without redesigning the interface.
6. Replace remaining source-text and dirty-diff assertions with executable behavior checks where practical.

The first post-release controller slice reduced `InventoryPage.jsx` from 953 lines to a focused composition surface. `useInventoryPageData.js` now owns shop-scoped loading and stale-safe part history, `useInventoryPartController.js` owns parts, stock, images, and barcode-label selection, and `useInventoryPurchasingController.js` owns vendors, purchase orders, status changes, and receiving.

The `0.3.1` version identifies this behavior-preserving maintainability release. Later version bumps remain deferred until each additional extraction slice holds under CI.

The job-service split is complete behind a 21-line compatibility facade. Normalization, queries, mutations, messaging, and child synchronization now have focused owners, and the transitional duplicate implementations have been removed.

The inventory-service split is complete behind its compatibility facade: shared normalization helpers, parts/vendor catalog helpers, purchase-order helpers, receiving/job-part helpers, and inventory history assembly now live in focused modules while existing imports remain intact.

The app-shell extraction now includes access/status panels, pure runtime helpers, offline draft orchestration, stale-safe job/customer loading, permission-aware online work-order actions, and session/shop bootstrap. The remaining `App.jsx` work is limited to smaller cross-domain composition concerns rather than authentication and tenant restoration.

Each extraction must preserve the current facade, permissions, database behavior, and regression suite. No broad rewrite.

## v0.3.x: Commerce hardening

- estimate approval and lifecycle clarity, including retry-safe estimate email delivery (implemented);
- stronger monetary-edit permissions and finalized-total audit behavior (implemented with role-separated payment/adjustment controls, append-only payment history, server-calculated invoice snapshots, and audited finalization/reopen locking);
- invoice and transaction numbering review (implemented with database-assigned invoice numbers, durable revision identity, and retry-safe transaction request numbers);
- deeper payment/refund support tooling;
- tax-profile and sales-history improvements (first reporting slice implemented; deeper reconciliation remains future work);
- public estimate links with secure hashed tokens, expiry, revocation, revision binding, and customer decisions (implemented); public invoice or work-order links remain deferred;
- billing reconciliation and operator support tools (read-only billing mismatch queue implemented; provider remediation remains support-controlled).

## v0.3.x: Correspondence and interface cohesion

- keep the provider-neutral customer correspondence schema and repository stable under shop-isolation and replay tests;
- add a focused conversation interface, unassigned inbound queue, read state, and explicit customer-report selection without duplicating Message History state (Conversation view, routing controls, Unassigned Inbox, and selected-message report output implemented);
- add the next inbound adapter (SMS) only after signature, consent, opt-out, routing, retry, and cost controls are complete; the Resend email adapter's signed ingress, route table, and replay ledger are now implemented;
- establish shared visual tokens and reusable form, panel, table, empty-state, action, feedback, and responsive-layout primitives;
- update major workspaces in measured slices so the product looks intentional and consistent without changing proven workflow behavior during the visual pass.

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
