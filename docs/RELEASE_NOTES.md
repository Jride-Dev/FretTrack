# Release Notes

## GitHub Release Summary: v0.2.7-beta.0

FretTrack `0.2.7-beta.0` moves the beta toward paid-access readiness: Trial, Shop, and Pro are now the public product model, expired trials preserve data while blocking writes, and flagged Supabase SECURITY DEFINER RPCs have explicit search paths, grants, and stronger write-path validation.

## Public Launch Site Refresh - In Progress

The public `frettrack-app.com` landing Worker has been redesigned around a launch-ready SaaS page: product screenshot
hero, repair-shop workflow, security posture, Trial/Shop/Pro pricing preview, and the existing beta application form.
The Worker now bundles the favicon package and landing screenshots through a static asset binding so the browser tab
icon and product imagery deploy with the public site.

## 0.2.8 Inventory Purchasing Foundation - In Progress

This foundation pass starts the 0.2.8 Inventory Operations Release without changing SMS, public document links, calendar sync, or offline mode.

### Added

- Shop-scoped vendors with contact details and active/inactive state.
- Purchase orders with draft, ordered, partially received, received, and cancelled states.
- Purchase order items with part links, descriptions, vendor SKU, ordered quantity, received quantity, and unit cost.
- Inventory receipts and receipt items for manual receives and purchase-order receives.
- Transactional receiving RPCs so stock increases, cost updates, receipt rows, purchase order received quantities, purchase order status, and `part_movements` history are written together.
- Part fields for vendor link, vendor SKU, barcode code, desired stock level, last cost, and average cost while preserving existing supplier/manufacturer/part number/unit cost/retail/quantity/reorder/location data.
- Inventory UI tabs for Parts, Vendors, Purchase Orders, and Purchase History.
- Stable barcode identity display/search using `FT-PART-{barcode_code}` without adding a barcode rendering package yet.
- Printable browser-based barcode label sheets using CODE128 barcodes through `jsbarcode`.
- Barcode search now handles both `FT-PART-{barcode_code}` and raw barcode code values.
- Purchase Orders now show status filters, expected and received dates, ordered/received/remaining quantities, receipt counts, estimated cost, and clear Mark Ordered / Cancel / Receive actions.
- Purchase History now shows date, part, vendor, PO, receipt reference, quantity, unit cost, total cost, received-by reference, and notes.
- Receiving RPCs now enforce stricter cost and quantity bounds while preserving transactional stock, receipt, and movement writes.

### Still Not Included

- Vendor import/export.
- Offline receiving or offline inventory conflict handling.
- SMS, public invoice/work-order links, or external calendar sync.

## GitHub Release Summary: v0.2.6-beta.14 Updates Since beta6

FretTrack has moved from the beta6 operations/storage baseline to a broader real-shop beta focused on access control, customer workflow, email documents, mobile readiness, editable billing details, inventory, scheduling, reporting foundations, premium trial management, safer editing, photo documentation, and first-pass offline continuity.

### Highlights Since beta6

- Beta access is now gated by an application and operator approval flow instead of automatically opening a shop workspace for every new sign-in.
- Approved beta users can now receive an approval email with the app login URL through the `notify-beta-approval` Supabase Edge Function.
- The internal operator dashboard now supports approval workflows, shop/member/usage visibility, beta-bypass handling, Shop/Pro trial start/extension/end controls, and status controls.
- Customer and subcontractor management are now first-class beta workflows, including profiles, balances, payment history, customer creation, and CRM-style lookup.
- Work orders and invoices can now be emailed from inside FretTrack through the authenticated Supabase Edge Function and Resend path.
- Existing work orders now support editable job-level parts and services while preserving totals, discounts, tax/VAT, payments, invoice summaries, and print output.
- Inventory parts foundation now covers shop-scoped parts, stock counts, job attachment, stock movement rows, low-stock indicators, and viewer-safe write controls.
- Scheduling / Calendar Phase 1 now covers internal schedule events, job due dates, intake appointments, pickup appointments, follow-ups, shop blocks, filters, and Job Detail scheduling.
- Premium entitlement architecture, operator-managed Shop/Pro trial controls, Shop Tier Foundation Phase 1, Paid Access Lifecycle Phase 1, and Advanced Reporting Phase 1 are in place without enabling Stripe, billing collection, self-service subscriptions, charts, exports, or PDFs.
- Permission hardening now centralizes operator/shop-role checks and separates photo upload, edit, overwrite, delete, and customer-report selection permissions.
- Public product wording is now Trial, Shop, and Pro. Internal `free`, `solo`, and `enterprise` values remain compatibility/fallback values during migration.
- Expired trials now preserve data and memberships, allow safe viewing, block writes, and lock premium entitlements until access is restored.
- Unsaved-changes protection now warns before losing manual edits in the first high-risk areas.
- Photo Editor Phase 1 now supports repair-shop image markup, text captions, crop, brightness, save-as-copy, guarded overwrite, and manual background cleanup.
- Mobile and tablet readiness improved with responsive layout work, touch-friendlier controls, camera-first photo capture, and installable PWA support.
- Offline continuity now covers new work order drafts with an IndexedDB-backed local queue, manual sync, discard, and last-error visibility.
- Print readability improved, but the Customer Damage Report and damage-map print system are still scheduled for a dedicated renderer rebuild.

### Still Not Included

- Stripe billing or live payment automation.
- Customer self-service subscription management.
- Printable barcode labels and deeper inventory workflows beyond the first vendors / purchase orders / receiving foundation.
- Full offline mode for existing job edits, photo queues, or cached authenticated Supabase data.
- SMS production messaging.
- Public invoice/work-order links.
- AI background removal or third-party image cutout APIs.

### Screenshots

![FretTrack Photo Editor Phase 1](screenshots/photo_editor.jpg)

## v0.2.6-beta.14

This beta adds the first safe offline continuity layer for intake days when the shop internet or Supabase connection goes sideways. It does not attempt full offline mode yet. Instead, new work orders can be saved as local drafts, reviewed clearly, and synced manually when the connection returns.

### Added

- Offline status chip and banner with clear local-draft messaging.
- IndexedDB-backed local draft queue for new work orders.
- Offline fallback for new job saves when network or remote save fails.
- Pending Local Drafts review screen with sync, discard, and last-error visibility.
- Manual one-at-a-time draft sync flow to avoid aggressive background syncing.

### Notes

- Beta 14 supports offline continuity for new work orders only.
- Existing remote job edits are still online-only and are clearly marked as unsupported while offline.
- Photos are not queued offline yet. Drafts can be synced first and images added after reconnecting.
- Local drafts are continuity protection for bench workflow, not a backup system.

### Not Included

- Full offline database
- Automatic background sync
- Offline edits to existing jobs
- Offline photo/blob queue
- Cached authenticated Supabase API data

## v0.2.6-beta.13

This beta makes FretTrack feel much better on phones and tablets without splitting the product into a second app. It adds installable PWA support, touch-friendlier layout behavior, and a faster camera-first photo workflow for bench use.

### Added

- PWA install support with manifest, service worker, and install prompt handling.
- iPhone/iPad install guidance banner for Add to Home Screen workflow.
- Mobile-friendly header/action layout and detail-first app layout behavior on smaller screens.
- Camera-first upload controls for job photos and damage-map view images.
- Touch-friendlier responsive controls for mobile and tablet use.

### Notes

- This is still the same React app, not a separate mobile site or native mobile app.
- The service worker is intentionally lightweight and focused on installability and shell caching, not offline job editing yet.
- Direct camera capture now sits alongside normal device import so shops can work faster at intake without losing the existing file picker flow.

### Not Included

- Separate mobile site
- React Native app
- Second codebase
- Railway backend

## v0.2.6-beta.12

This beta tightens up the day-to-day billing workflow by making job-level parts and services fully editable on the work order while preserving totals, payments, print output, and invoice email summaries.

### Added

- Editable parts rows on work orders.
- Editable services/labor rows on work orders.
- Clear add/remove controls for job-level parts and services.
- Read-only-safe parts/services UI that respects shop role and billing state.

### Notes

- This is still job-level editing only, not the future inventory module.
- Totals, discounts, tax, balance due, invoice emails, and print sheets now continue reflecting edited part and service values.
- Payment history behavior is unchanged.

### Not Included

- Inventory catalog
- Vendor management
- Stock tracking
- SKU database
- Purchase orders
- Reorder levels

## v0.2.6-beta.11

This beta adds in-app email workflow for work orders and invoice summaries so shops can send customer-ready documents without leaving FretTrack.

### Added

- Email Work Order action from Job Detail.
- Email Invoice action from the billing/totals workflow.
- Email preview modal with editable recipient, subject, and message body.
- Work order and invoice email summaries using existing Supabase Edge Function and Resend delivery flow.
- Job event logging for `work_order_emailed` and `invoice_emailed`.

### Notes

- Customer and subcontractor email sending uses the existing authenticated `send-email` Edge Function path.
- Recipient validation now blocks send when the selected customer or subcontractor has no valid email address.
- Email Statement remains a future customer-profile follow-up rather than part of this release.

### Known Issues

- Customer Damage Report print layout still requires redesign.
- Damage-map print rendering is inconsistent across print preview/browser flows.
- Visual damage-map print markers are temporarily disabled in production print output.
- Dedicated print renderer planned.

## v0.2.6-beta.10

This beta release promotes the new customer and subcontractor CRM workflow to a full beta milestone while documenting remaining print-system instability.

### Added

- Customer/Subcontractor management module.
- Customer profiles.
- Customer balances and payment history.
- CRM-style customer workflow.
- Customer creation modal.
- Mobile/tablet responsive improvements.
- Beta access workflow improvements.
- Email notification workflow.

### Known Issues

- Customer Damage Report print layout still requires redesign.
- Damage-map print rendering is inconsistent across print preview/browser flows.
- Visual damage-map print markers are temporarily disabled in production print output.
- Dedicated print renderer planned.

### Roadmap Note

- Replace current damage-map print approach with dedicated print-only renderer.
- Separate screen interaction rendering from printable report rendering.
- Rebuild visual print marker rendering behind screenshot checkpoints before re-enabling.

## v0.2.6-beta.9

FretTrack beta is getting sturdier for real shop use. This release tightens access, improves operator control, and makes the app friendlier on mobile and in print.

### Highlights

- Beta access approval gate so new sign-ins do not automatically enter a shop workspace.
- Operator approval workflow in the internal dashboard.
- Landing page beta application flow that creates real beta access requests.
- Email notifications for beta applications.
- Mobile and tablet responsive improvements across core screens.
- Print output improvements for job sheets and customer reports.
- Security and access hardening around beta onboarding and workspace bootstrap.

### Notes for beta testers

- Approved beta users should continue to sign in and work normally.
- Pending users will see an approval screen until an operator approves access.
- Print sheets should now be darker and easier to read.
- The app remains focused on repair workflow, not billing automation.

### GitHub summary

- Access control: beta approval requests and operator approvals.
- UX: better landing page application, mobile/tablet layout, and print readability.
- Stability: security/access hardening with no Stripe or billing automation added yet.
