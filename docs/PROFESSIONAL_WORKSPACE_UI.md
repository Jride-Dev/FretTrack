# Professional Workspace UI

FretTrack's authenticated application shell uses one grouped navigation system for the complete repair-shop workflow. It is a presentation and navigation layer over the existing module boundaries; it does not duplicate job, customer, inventory, billing, subscription, or permission logic.

## Navigation

The desktop rail groups destinations into Workspace, Repair, Operations, Insights, and Administration. New Work Order and Save Work Order remain visible as primary shop actions. On narrower screens, the same destinations reflow into a compact horizontal layout, and Current Jobs becomes contained mobile cards without horizontal page overflow.

## Current Jobs

The page begins with active-job, priority, and next-due summaries. Existing search, priority, status, due-date, assigned-technician, scope, and sort controls remain authoritative. Selecting a result opens the appropriate Guitar, Amplifier, or Keyboard work order through the shared workspace router.

## Themes

The selector supports Use Device Theme, Bench Dark, Shop Light, Amber Tube, Seafoam, Blackguard, Burgundy Burst, Blue Steel, and High Contrast. Device mode resolves to the appropriate light or dark base and follows operating-system changes. The selected preference is persisted locally. Print documents continue to use their isolated white customer-document canvas regardless of the interactive theme.

## Public screenshots

The landing page and primary public help pages use real application captures from Bench Dark and Shop Light. Before capture, the local fixture shop and customer names are replaced with fictional values and local system announcements are hidden. No production customer or shop data is included.

The maintained publication files are:

- `cloudflare/frettrack-coming-soon/public/landing/current-jobs-bench-dark.png`
- `cloudflare/frettrack-coming-soon/public/landing/current-jobs-shop-light.png`

## Validation

Run `npm run check:professional-workspace-ui` for the static UI contract and `npx playwright test tests/e2e/authenticated/professional-workspace-ui.spec.js --project=chromium` for authenticated desktop, theme-persistence, and mobile-containment coverage.
