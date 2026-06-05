# Release Notes

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
