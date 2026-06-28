# Reports

FretTrack Pro Reports are operational reports built from the current shop data already used by jobs, customers, inventory, purchase orders, work logs, and scheduling.

## Access

Advanced Reporting is available for Pro and Trial Pro shops. Shop-tier users see the Pro lock state instead of report data.

## Current Sections

- Shop Overview
- Revenue Snapshot
- Baseline Metrics
- Jobs by Status
- Priority Report
- Overdue / Promise Date
- Ready for Pickup
- Waiting on Parts
- Job Aging
- Recent Work-Log Activity
- Inventory Low Stock
- Purchase Order Status
- Purchase History / Landed Cost
- Upcoming Schedule Workload

## Print Support

The Reports page includes a `Print Reports` action that uses the browser print flow. This is intended for paper output or browser Save as PDF.

Print mode:

- hides navigation, buttons, filters, form controls, and internal-only UI
- keeps the report title, generated date, and scope/range metadata visible
- uses a light print background
- keeps cards and table sections readable
- avoids page breaks inside report cards and report sections where practical

FretTrack does not generate PDF files directly in this phase.

## CSV Export

Report sections with tables include a per-section `Export CSV` action.

Current CSV exports include:

- Jobs by Status
- Overdue Jobs
- Ready for Pickup
- Waiting on Parts
- Job Aging
- Recent Work Log Activity
- Low Stock Inventory
- Purchase Orders
- Purchase / Landed Cost History
- Upcoming Schedule

The Reports header also includes `Export Summary CSV` for high-level counts and totals.

CSV behavior:

- values with commas, quotes, or newlines are escaped correctly
- empty sections export headers
- filenames are generated as safe names such as `frettrack-overdue-jobs-2026-06-27.csv`
- exports are capped at 1,000 rows per click
- if a section has more than 1,000 rows, the first 1,000 rows export and the UI warns the user

## Large Dataset Safety

Reports are designed to avoid freezing the app when a shop has a larger dataset.

Current limits:

- table previews show 25 rows by default
- sections show a row-count message such as `Showing 25 of 312 rows`
- `Show all visible rows` is available only when the section has 250 rows or fewer
- CSV export is capped at 1,000 rows
- each report section has an error boundary so one broken section does not trigger the global app fallback

Current service-side limits already apply to:

- recent work-log activity
- upcoming schedule window
- purchase history from the existing inventory service

Future work should add server-side report aggregation/RPCs and stricter query windows if real shops outgrow the current client-side safety layer.

## Filters

The Reports page includes simple filters for:

- Jobs by Status summary: all loaded statuses, open statuses, or closed statuses
- recent work-log activity
- purchase history

The operational job sections remain focused on active/open work.

## Deferred

Not included yet:

- PDF generation dependencies
- charts
- scheduled report emails
- accounting/tax report exports
- Stripe revenue analytics
- server-side report warehouse or aggregate RPCs
