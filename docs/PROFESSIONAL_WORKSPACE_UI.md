# Professional Workspace UI

FretTrack's authenticated application shell uses one grouped navigation system for the complete repair-shop workflow. It is a presentation and navigation layer over the existing module boundaries; it does not duplicate job, customer, inventory, billing, subscription, or permission logic.

## Navigation

The desktop rail groups destinations into Workspace, Repair, Operations, Insights, and Administration. New Work Order and Save Work Order remain visible as primary shop actions. On narrower screens, the same destinations reflow into a compact horizontal layout, and Current Jobs becomes contained mobile cards without horizontal page overflow.

## Current Jobs

The page begins with active-job, priority, and next-due summaries. Existing search, priority, status, due-date, assigned-technician, scope, and sort controls remain authoritative. Selecting a result opens the appropriate Guitar, Amplifier, or Keyboard work order through the shared workspace router.

## Work orders

New Work Order and the shared Work Order, Parts & Payments view use the same page-heading, section, and action hierarchy. Intake is grouped into Customer, Instrument, Shop workflow, and Customer request sections without changing any field validation or save behavior. Saved jobs use a restrained tab bar and contained content panels; billing tables, permissions, finalization, payment, and tax handlers remain the established commerce paths.

The shared presentation primitives live in `src/shared/components/WorkspacePageHeader.jsx` and `src/shared/components/WorkspaceSection.jsx`. They carry layout and accessibility structure only. They do not load data, choose a shop, decide entitlements, or persist a record.

## Customers

Customers uses a full-width workspace with the shared page-heading and section hierarchy for directory search, filters, the selectable customer list, account metrics, contact details, job history, payments, and notes. The desktop directory-and-profile layout collapses into one contained column on tablets and phones, and long identity or contact values wrap inside their cards. Add Customer, Edit Profile, Create Job, CSV preview, Loyalty, and service-reminder behavior still use their existing permission, entitlement, dirty-state, and customer-service boundaries.

## Inventory

Inventory now uses a full-width workspace with a restrained Parts, Vendors, Purchase Orders, Purchase History, and Barcode Labels tab rail. Parts search and label selection stay above a contained, horizontally scrollable table beside the existing editor; vendor and purchase-order detail retain the same pattern. Add Part, receiving, stock adjustments, vendor saves, purchase-order status changes, label printing, and all shop-scoped inventory services remain unchanged.

## Themes

The selector supports Use Device Theme, Bench Dark, Shop Light, Amber Tube, Seafoam, Blackguard, Burgundy Burst, Blue Steel, and High Contrast. Device mode resolves to the appropriate light or dark base and follows operating-system changes. The selected preference is persisted locally. Print documents continue to use their isolated white customer-document canvas regardless of the interactive theme.

## Public screenshots

The landing page and primary public help pages use real application captures from Bench Dark and Shop Light. Before capture, the local fixture shop and customer names are replaced with fictional values and local system announcements are hidden. No production customer or shop data is included.

The maintained publication files are:

- `cloudflare/frettrack-coming-soon/public/landing/current-jobs-bench-dark.png`
- `cloudflare/frettrack-coming-soon/public/landing/current-jobs-shop-light.png`
- `cloudflare/frettrack-coming-soon/public/landing/new-work-order-bench-dark.png`
- `cloudflare/frettrack-coming-soon/public/landing/work-order-billing-bench-dark.png`
- `cloudflare/frettrack-coming-soon/public/landing/customers-bench-dark.png`
- `cloudflare/frettrack-coming-soon/public/landing/inventory-bench-dark.png`

Run `npm run capture:professional-work-orders` against the disposable local test workspace to refresh the New Work Order and Parts & Billing captures. Run `npm run capture:professional-customers` or `npm run capture:professional-inventory` to refresh the Customers or Inventory captures. The capture scripts authenticate only to the seeded local owner and replace fixture labels with fictional publication names before writing the images.

## Validation

Run `npm run check:professional-workspace-ui` and `npm run check:professional-customers-ui` for the static UI contracts. Run `npx playwright test tests/e2e/authenticated/professional-workspace-ui.spec.js --project=owner-chromium` for authenticated desktop, work-order and customer hierarchy, theme-persistence, and mobile-containment coverage.
