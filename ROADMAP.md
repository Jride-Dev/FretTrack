# Roadmap

This file tracks where FretTrack is headed after the current `0.2.6-beta.2` private beta baseline.

## Current Release Position

- First public trial-ready release.
- Email notifications active.
- SMS planned/optional.
- Dark theme default.
- Work order system stable enough for real shop testing.
- v0.2.4 adds module stabilization, photos-module ownership, shop config foundations, and non-blocking job event logging for the future activity timeline.
- v0.2.5 adds a visible activity timeline, basic shop settings, trial-readiness documentation, data integrity checks, and job JSON export for debugging.
- v0.2.6-beta.1 adds auth/shop membership foundations, shop-scoped RLS audit work, a standalone customer module, customer import-prep fields, and migration drift guard tooling.

## Near Term

- Continue real shop testing against the `0.2.x` baseline.
- Apply and verify the `job_events` migration alongside the multi-shop job-number migration before relying on timeline data in live shops.
- Walk through `docs/TRIAL_READINESS.md` before the first live trial-shop session.
- Keep email-only trial messaging active while SMS remains disabled.
- Use the themed UI, subcontractor/job-source intake, damage-map persistence fixes, manual save feedback, and editable work logs as the current stable baseline.
- Keep `bench-dark` as the default theme for first-time users unless trial feedback says otherwise.
- Keep `npm run check:migrations` quiet before every Supabase push.

## Customer Management And Import

- Build the customer import workflow in this order: raw spreadsheet row, `customerImportMapper`, normalization, validation, duplicate detection, preview, then bulk insert/update.
- Add an import preview screen that stages rows, shows validation warnings, and flags same-shop duplicate candidates before writing anything.
- Add bulk customer insert/update through `customerService` only after rows have already been mapped, normalized, validated, and reviewed.
- Add duplicate merge/reconciliation behavior before allowing large real-shop imports.
- Keep customer import UI separate from normal Customer Add so day-to-day customer creation stays simple.

## Packaging and Installation

- Create shop-specific installer packages so trial users can install FretTrack without manually running project files or touching Supabase/Resend.
- Treat each shop as a separate Supabase project/database under the FretTrack operator account.
- Keep Resend ownership under the FretTrack operator account, with shop-specific sender/domain configuration handled during provisioning.
- Generate a per-shop config containing the shop Supabase URL, anon key, FretTrack function key, SMS setting, and later shop branding/display values.
- Support a first packaging target of a customer-specific `.zip`, then graduate to a signed `.exe` installer when the onboarding flow is stable.
- Keep `.msi` as a later option for managed Windows/IT deployment.
- Include desktop shortcut creation, app launch scripts, required runtime checks, and clear setup prompts in the installer flow.
- Document installer build steps, shop provisioning steps, and release checklist before broader trial distribution.
- Keep the existing manual launch scripts available as a fallback while installer packaging is tested.

## Messaging

- Add Supabase Realtime delivery for `system_announcements` so maintenance/bug-fix notices appear during an active logged-in session without requiring logout/login.
- Keep announcement polling as a fallback, but trigger a refetch immediately when Realtime receives a new announcement insert.
- Continue targeting announcements by shop/user membership first; defer session-id-specific targeting until there is a real need for force-logout, per-device notices, or acknowledgment auditing.
- Add operator notifications for new `beta_feedback` reports, likely email first, then optional GitHub issue creation after private data handling is settled.
- Add a lightweight operator/admin feedback view for reading, triaging, and updating `beta_feedback.status` without opening Supabase directly.
- Add SMS after carrier registration is ready.
- Keep SMS buttons visible but disabled in trial builds so the workflow remains discoverable.
- Keep the existing `send-sms` Edge Function code available for later Twilio/carrier registration work.
- Continue using Supabase Edge Functions as the only message-sending path.

## Security and Accounts

- Replace the temporary shop-level public-trial gate with proper user authentication.
- Add the first Supabase Auth sign-in gate and shop membership table.
- Add member invitation and member-management screens after the first auth gate is verified.
- Connect `job_events.created_by` to authenticated users once auth exists.
- Keep the shared function key setup only as temporary public-trial protection.
- Add organization membership roles so monetary controls can be restricted by role.
- Allow regular employees to add payments without allowing them to edit discounts, taxes, labor totals, parts totals, or other monetary adjustments.

## Accounting and Totals

- Modularize the accounting/totals code so discounts, taxes, payments, balances, and till reporting have clearer ownership.
- Change discount handling so applying a discount commits it into the saved work order totals instead of leaving it as an always-editable field.
- Lock monetary totals after they are saved/applied to protect tax and audit accuracy.
- Show an `Edit Totals` action only when reopening an existing work order or intentionally entering a totals-editing mode.
- Tie `Edit Totals` access to future organization member roles; regular employees should be able to add payments only.
- Preserve payment entry as an operational action that does not require full monetary edit permissions.

## Parts and Inventory

- Add a dedicated parts/inventory module after the first trial baseline is stable.
- Track common repair parts such as strings, pots, jacks, switches, pickups, tuners, nuts, saddles, screws, batteries, strap buttons, and shop consumables.
- Support part name, SKU/part number, category, vendor, cost, retail price, quantity on hand, reorder level, storage location, and active/inactive status.
- Allow work orders to add parts from inventory while preserving free-typed one-off parts for unusual repairs.
- Decrement inventory when parts are committed to a work order, with clear handling for returns, deleted parts, and corrected quantities.
- Surface low-stock and out-of-stock states without blocking urgent repair intake.
- Keep inventory cost/retail changes from rewriting historical work order totals.
- Add basic vendor and purchase/restock history after the first inventory version is usable.
- Tie inventory price editing, stock adjustments, and cost visibility to future organization member roles.
- Keep inventory reporting focused on practical shop needs first: low stock, parts used by date range, value on hand, and job-linked parts usage.

## Product Direction

- Continue improving the work order flow for real shop use.
- Explore a future paid upgrade for AI-assisted 3D JavaScript instrument visualization: generate or select a modeled instrument from uploaded photos or preset instrument images, then let shops zoom, rotate, and inspect instrument sections without requiring many separate uploaded photos.
- Expand Activity Timeline filtering and detail views after initial trial feedback.
- Expand customer communication around check-in, estimate approval, repair status, pickup reminders, payment reminders, and photo updates.
- Keep customer history lookup, quick-fill, and repeat-customer workflows central to intake.
- Keep supporting unusual instruments by allowing free-typed brand/model values even when suggestions exist.
- Keep print/export views readable regardless of active app theme.

## Future Polish Candidates

- Tighten trial feedback around the Acoustic / Electric / Bass instrument flow.
- Review damage-map usability after real repair intake sessions.
- Consider expanding theme presets only after the current preset system has settled.
