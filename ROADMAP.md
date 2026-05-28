# Roadmap

This file tracks where FretTrack is headed after the current `0.2.6-beta.6` private beta baseline.

## Current Release Position

- Invite-only beta release is live.
- Cloudflare Pages serves the production app at `app.frettrack-app.com`.
- Supabase Auth, shop memberships, shop-scoped RLS, private Storage, Edge Functions, and onboarding are in place.
- Email notifications are active. SMS plumbing exists, but SMS remains disabled until carrier registration and pricing are ready.
- Work orders, standalone customers, damage maps, customer lookup, optimized photo uploads, payments, print sheets, activity timeline, reports, CSV export, shop profile settings, and customer messaging are available.
- Paid-tier foundations are present without Stripe: plans, entitlements, subscriptions, trial/grace/read-only/beta-bypass states, usage snapshots, and a billing placeholder.
- The internal Beta Operator Dashboard is available for operator users to inspect beta shops, usage, recent activity, and subscription/trial state.

## Near Term

- Continue real shop testing against the `0.2.6-beta.6` baseline.
- Watch photo upload optimization, Job Sheet printing, payment autosave, and customer messaging first during beta sessions.
- For multi-user shops, test adding an existing signed-up user by email, changing their role, and removing them.
- Keep `npm run check:migrations` quiet before every Supabase push.
- Keep the Beta Operator Dashboard as the main support surface for beta shops.
- Keep email-only trial messaging active while SMS remains disabled.
- Keep `bench-dark` as the default theme for first-time users unless trial feedback says otherwise.
- Keep print/export views readable regardless of active app theme.

## Member Management

- Keep the new owner/admin member-management panel in Shop Settings focused on current beta needs.
- Add full email invitation later through a server-side Auth Admin flow, not frontend-only logic.
- Add member deactivation/suspension if removal proves too destructive for support workflows.
- Add member activity review once `job_events.created_by` is wired consistently.
- Keep viewer read-only, tech operational, and owner/admin administrative permissions aligned with existing RLS and helper functions.
- Confirm role changes, removals, and last-owner protection during beta smoke tests.

## Employee Permissions / Staff Roles

Planned for multi-user paid tiers, especially Shop Pro and above.

- Expand the current basic shop membership roles into granular staff permission management for larger shops.
- Add an Admin or Staff Management page where shop owners/admins can invite/remove employees, assign roles, and manage access.
- Support roles such as Owner, Admin, Technician, Front Desk / Intake, Accounting / Reports, and Read-only.
- Add granular permissions for create/edit jobs, delete jobs, manage customers, upload/delete images, manage pricing, manage shop settings, manage billing/subscription, access accounting exports, manage employees, and future inventory management.
- Restrict sensitive accounting, reporting, billing, inventory, admin, and settings areas by permission instead of relying only on broad role names.
- Preserve technician-only workflow access for employees who need job/photo/service access without full financial or admin visibility.
- Add reporting visibility controls and future audit visibility by employee once activity tracking is mature.
- Keep Solo/basic tiers on simplified role handling where appropriate, while larger paid shops unlock advanced staff management.

## Customer Management And Import

- Build the customer import workflow in this order: raw spreadsheet row, `customerImportMapper`, normalization, validation, duplicate detection, preview, then bulk insert/update.
- Add an import preview screen that stages rows, shows validation warnings, and flags same-shop duplicate candidates before writing anything.
- Add bulk customer insert/update through `customerService` only after rows have already been mapped, normalized, validated, and reviewed.
- Add duplicate merge/reconciliation behavior before allowing large real-shop imports.
- Keep customer import UI separate from normal Customer Add so day-to-day customer creation stays simple.

## Beta Operations

- Add operator notes to beta shops.
- Add clearer feedback triage for `beta_feedback`: status, priority, owner, last contacted, and follow-up notes.
- Add operator notifications for new `beta_feedback` reports, likely email first, then optional GitHub issue creation after private data handling is settled.
- Keep manual beta billing and beta-bypass controls available until Stripe is intentionally introduced.
- Maintain a short beta smoke checklist for create job, upload photo, print Job Sheet, add payment, export/open report, and send test email.

## Paid Tier Readiness

- Keep Stripe out until entitlement/trial/read-only behavior is stable in real beta use.
- Add storage quota warnings before upload blocks feel surprising.
- Tighten usage snapshots and storage accounting as beta shops upload real images.
- Add billing contact email and support/cancellation copy before paid launch.
- Add Terms, Privacy, data export, and account deletion policy placeholders before self-serve paid onboarding.
- Integrate Stripe Checkout, Customer Portal, and webhooks only after the current manual billing flow and entitlement model are proven.

## Messaging

- Add Supabase Realtime delivery for `system_announcements` so maintenance/bug-fix notices appear during an active logged-in session without requiring logout/login.
- Keep announcement polling as a fallback, but trigger a refetch immediately when Realtime receives a new announcement insert.
- Continue targeting announcements by shop/user membership first; defer session-id-specific targeting until there is a real need for force-logout, per-device notices, or acknowledgment auditing.
- Add SMS after carrier registration is ready.
- Keep SMS buttons visible but disabled in beta builds so the workflow remains discoverable.
- Keep the existing `send-sms` Edge Function code available for later Twilio/carrier registration work.
- Continue using Supabase Edge Functions as the only message-sending path.

## Accounting and Totals

- Modularize the accounting/totals code so discounts, taxes, payments, balances, and till reporting have clearer ownership.
- Change discount handling so applying a discount commits it into the saved work order totals instead of leaving it as an always-editable field.
- Lock monetary totals after they are saved/applied to protect tax and audit accuracy.
- Show an `Edit Totals` action only when reopening an existing work order or intentionally entering a totals-editing mode.
- Tie `Edit Totals` access to organization member roles; regular employees should be able to add payments only.
- Preserve payment entry as an operational action that does not require full monetary edit permissions.
- Gradually integrate the commerce event backbone, starting with committed payment or closeout events.

## Parts and Inventory

- Add a dedicated parts/inventory module after the first trial baseline is stable.
- Track common repair parts such as strings, pots, jacks, switches, pickups, tuners, nuts, saddles, screws, batteries, strap buttons, and shop consumables.
- Support part name, SKU/part number, category, vendor, cost, retail price, quantity on hand, reorder level, storage location, and active/inactive status.
- Allow work orders to add parts from inventory while preserving free-typed one-off parts for unusual repairs.
- Decrement inventory when parts are committed to a work order, with clear handling for returns, deleted parts, and corrected quantities.
- Surface low-stock and out-of-stock states without blocking urgent repair intake.
- Keep inventory cost/retail changes from rewriting historical work order totals.
- Add basic vendor and purchase/restock history after the first inventory version is usable.
- Tie inventory price editing, stock adjustments, and cost visibility to member roles.
- Keep inventory reporting focused on practical shop needs first: low stock, parts used by date range, value on hand, and job-linked parts usage.

## Product Direction

- Continue improving the work order flow for real shop use.
- Add shop-custom job/status dropdown values after beta testers clarify the statuses they need.
- Expand Activity Timeline filtering and detail views after beta feedback shows what shops actually need.
- Expand customer communication around check-in, estimate approval, repair status, pickup reminders, payment reminders, and photo updates.
- Keep customer history lookup, quick-fill, and repeat-customer workflows central to intake.
- Keep supporting unusual instruments by allowing free-typed brand/model values even when suggestions exist.
- Explore a future paid upgrade for AI-assisted 3D JavaScript instrument visualization only after the core repair workflow, member management, storage, and billing foundations are stable.

## Build Performance

- Lazy-load HEIC/HEIF photo conversion so the heavy `heic2any` dependency is downloaded only when a shop uploads a HEIC/HEIF image.
- Review Vite bundle chunks after lazy-loading photo conversion and consider additional code splitting only where it improves first-load time without making the beta workflow brittle.

## Mobile And Tablet

- Keep the browser-based app usable on phones and tablets without turning it into a separate mobile product.
- Add a tablet intake mode later if real bench use shows the current stacked layout is still too busy on iPad-sized screens.
- Consider direct camera capture, signature capture, PWA install support, and an offline draft queue only after the current browser workflow is stable on smaller screens.
- Keep improving touch spacing, responsive grids, and modal behavior as real beta use exposes the remaining rough edges.

## Future Polish Candidates

- Tighten trial feedback around the Acoustic / Electric / Bass instrument flow.
- Review damage-map usability after real repair intake sessions.
- Consider expanding theme presets only after the current preset system has settled.
- Improve mobile and tablet density after real bench use exposes the rough edges.
