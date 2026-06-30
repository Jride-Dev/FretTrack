# FretTrack Beta Tester Checklist

Use this checklist while testing FretTrack as a real repair-shop workflow tool. The Excel workbook is the recommended tester file because it includes a compact checklist, detailed test references, dropdowns, and a bug log. The CSV remains available as a fallback for spreadsheet tools that cannot open the workbook.

Public tester page:

- `https://frettrack-app.com/beta-tester`

Recommended workbook download:

- `/downloads/frettrack-beta-tester-workbook.xlsx`

CSV fallback download:

- `/downloads/frettrack-beta-tester-checklist.csv`

## Workbook Sheets

- `Start Here`: Testing instructions, status/severity guide, and feedback notes.
- `Quick Checklist`: Compact pass/fail testing sheet for normal beta testing.
- `Detailed Tests`: Longer expected-result reference sheet when a row needs more context.
- `Bug Log`: Longer bug details, reproduction steps, actual/expected behavior, and issue links.
- `Lists`: Dropdown values for status, severity, reproducibility, report channel, and role.

## Who Should Use It

Use this checklist if you are testing FretTrack as a shop owner, admin, tech, viewer, or invited beta tester. It is especially useful when testing on multiple devices, browsers, or roles.

## How To Test

1. Sign in with the beta account and shop role you were asked to test.
2. Work through each row in order, or focus on the sections assigned to you.
3. Try to use realistic repair-shop data, but avoid private customer information.
4. Use the `Quick Checklist` sheet first, then open `Detailed Tests` only when you need the longer expected result.
5. If a failure blocks the rest of a section, mark the blocked rows as `Blocked`.
6. Use the in-app **Report Issue** button first when available, then paste the issue link or reference back into the workbook.

## Status Values

- `Pass`: Worked as expected.
- `Fail`: Did not work as expected.
- `Blocked`: Could not test because another issue stopped the workflow.
- `Not Tested`: Not tested in this pass.
- `Needs Clarification`: The expected behavior was unclear.

## Severity Values

- `Low`: Minor polish or confusing copy.
- `Medium`: Workflow annoyance or partial break.
- `High`: Blocks important shop work.
- `Critical`: Login, data safety, security, cross-shop access, or data loss risk.

## How To Submit Bugs

If you have app access, use the in-app **Report Issue** control when possible so FretTrack can include browser, shop, page, and selected-job context.

For completed checklists, screenshots, screen recordings, and longer notes, send them to `support@frettrack-app.com` or through the FretTrack beta feedback channel provided with your invite.

## Screenshots And Device Details

For useful bug reports, include:

- Browser and device, for example `Safari / iPadOS 17`, `Chrome / Windows 11`, or `Safari / iOS 12`.
- Shop role, for example `Owner`, `Admin`, `Tech`, or `Viewer`.
- Job number, customer name, or part/vendor/PO number if relevant.
- Whether the issue reproduces after refresh/sign-out/sign-in.
- Screenshot or video link if the issue is visual.

## Checklist

| Section | Test ID | Test Item | Expected Result | Suggested Role |
| --- | --- | --- | --- | --- |
| Login and Shop Access | LOGIN-001 | Sign in with an approved beta account. | Login succeeds and the app begins session and shop checks. | Owner/Admin/Tech/Viewer |
| Login and Shop Access | LOGIN-002 | Load the main dashboard/workspace after login. | The app loads without a blank screen and shows the correct shop workspace. | Owner/Admin/Tech/Viewer |
| Login and Shop Access | LOGIN-003 | Switch shops when the account has multiple memberships. | Shop selection changes the active workspace without leaking data from another shop. | Owner/Admin |
| Login and Shop Access | LOGIN-004 | Confirm pending or unapproved access messaging if using a not-yet-approved account. | The tester sees clear pending approval guidance and cannot create a shop early. | Tester |
| Customers | CUSTOMER-001 | Create a customer record. | Customer saves with name, phone/email, contact preferences, and address details intact. | Owner/Admin/Tech |
| Customers | CUSTOMER-002 | Select an existing customer from New Job intake. | Customer fields fill correctly without duplicating or overwriting existing details. | Owner/Admin/Tech |
| New Job Intake | JOB-001 | Create a new repair job. | Job saves with a job number and appears in the job list. | Owner/Admin/Tech |
| New Job Intake | JOB-002 | Fill Instrument Details. | Instrument Type, Brand, Model, Year, Serial Number, Color, Finish, and Orientation remain clear and optional where intended. | Owner/Admin/Tech |
| New Job Intake | JOB-003 | Use Brand/Model suggestions. | Brand suggestions appear and Model suggestions filter by selected brand. | Owner/Admin/Tech |
| New Job Intake | JOB-004 | Enter a custom brand and custom model. | Custom values save without being blocked by suggestions. | Owner/Admin/Tech |
| New Job Intake | JOB-005 | Enter Year, Finish, and Orientation. | Optional values save and display correctly on the job. | Owner/Admin/Tech |
| New Job Intake | JOB-006 | Set job Priority. | HIGH, Medium, and Regular / Low values save and display with readable labels. | Owner/Admin/Tech |
| New Job Intake | JOB-007 | Set a Promise Date. | Promise Date saves, displays on the job, and supports overdue reporting. | Owner/Admin/Tech |
| Job Detail and Workflow | JOBDETAIL-001 | Open an existing job. | Job Detail loads customer, instrument, status, photos, parts, services, and work sections. | Owner/Admin/Tech/Viewer |
| Job Detail and Workflow | JOBDETAIL-002 | Change job status. | Status saves and reflects in lists/reports. | Owner/Admin/Tech |
| Job Detail and Workflow | JOBDETAIL-003 | Save job edits. | Save succeeds, dirty state clears, and updated values remain after refresh. | Owner/Admin/Tech |
| Work Logs and Job History | WORKLOG-001 | Add a work log entry. | Work log saves, appears in history/timeline, and is visible in reports where applicable. | Owner/Admin/Tech |
| Work Logs and Job History | WORKLOG-002 | Review job history/timeline. | Status changes, work logs, photos, emails, and inventory events appear in useful order. | Owner/Admin/Tech/Viewer |
| Photos and Damage Map | PHOTO-001 | Upload job photos. | Photos upload, preview, and reopen using saved URLs. | Owner/Admin/Tech |
| Photos and Damage Map | PHOTO-002 | Open saved photo previews. | Saved photos open without broken blob URLs. | Owner/Admin/Tech/Viewer |
| Photos and Damage Map | PHOTO-003 | Use Damage Map views. | Front, Back, Headstock, and Serial Number views accept photos/markers and save correctly. | Owner/Admin/Tech |
| Photos and Damage Map | PHOTO-004 | Include photos in customer-facing report. | Selected photos appear in the report without internal-only fields. | Owner/Admin/Tech |
| Scheduling | SCHED-001 | Create a schedule event. | Event saves with date/time, type, title, status, and optional job link. | Owner/Admin/Tech |
| Scheduling | SCHED-002 | Review upcoming schedule workload. | Upcoming events display in calendar/panels/reports within the expected date range. | Owner/Admin/Tech/Viewer |
| Inventory Parts | INV-001 | Create an inventory part. | Part saves with name, quantity, reorder/desired stock, vendor, UPC/barcode, prices, and preset location/category. | Owner/Admin/Tech |
| Inventory Parts | INV-002 | Trigger low stock. | Normal stocked part shows low-stock state when quantity on hand is at or below desired/reorder level. | Owner/Admin/Tech/Viewer |
| Inventory Parts | INV-003 | Use manual receive or adjust. | Stock changes correctly and records a movement row. | Owner/Admin/Tech |
| Inventory Parts | INV-004 | Mark a part as Special Order Part. | Desired stock is ignored, low-stock nags do not appear, and the part remains usable on jobs/POs/receiving. | Owner/Admin/Tech |
| Inventory Parts | INV-005 | Attach a valid small part image. | Image 300x300 px or smaller saves and previews on the part. | Owner/Admin/Tech |
| Inventory Parts | INV-006 | Try attaching an oversized part image. | Larger image is rejected clearly without resizing, compression, or storage. | Owner/Admin/Tech |
| Inventory Parts | INV-007 | Manage inventory presets in Shop Settings. | Owner/Admin can set Location and Category preset lists; parts use those dropdown values while old saved text remains visible. | Owner/Admin |
| Vendors, Purchase Orders, and Receiving | PO-001 | Create a vendor with Company and Sales Rep details. | Vendor saves company/contact details with clear labels. | Owner/Admin/Tech |
| Vendors, Purchase Orders, and Receiving | PO-002 | Mark a vendor Online Only. | Online-only behavior is clear and does not destroy existing address/phone data. | Owner/Admin/Tech |
| Vendors, Purchase Orders, and Receiving | PO-003 | Create a purchase order. | PO saves with vendor, line items, quantities, unit costs, status, and expected dates. | Owner/Admin/Tech |
| Vendors, Purchase Orders, and Receiving | PO-004 | Add Shipping Cost to a PO. | Shipping cost saves and appears in PO status/reporting. | Owner/Admin/Tech |
| Vendors, Purchase Orders, and Receiving | PO-005 | Enable Add shipping to cost. | Receiving allocates shipping into landed cost when enabled. | Owner/Admin/Tech |
| Vendors, Purchase Orders, and Receiving | PO-006 | Receive a full purchase order. | Stock increases, receipt history records, PO status updates, and part movements are created. | Owner/Admin/Tech |
| Vendors, Purchase Orders, and Receiving | PO-007 | Receive a partial purchase order. | Partial receive updates received/remaining quantities without over-receiving. | Owner/Admin/Tech |
| Vendors, Purchase Orders, and Receiving | PO-008 | Verify landed cost. | Landed unit cost and total landed cost include allocated shipping where applicable. | Owner/Admin/Tech |
| Vendors, Purchase Orders, and Receiving | PO-009 | Review purchase history. | Purchase history shows received date, part, vendor, quantity, unit cost, shipping allocation, and landed cost. | Owner/Admin/Tech/Viewer |
| Barcode Labels | BARCODE-001 | Confirm barcode identity. | Part shows stable `FT-PART-{barcode_code}` identity. | Owner/Admin/Tech/Viewer |
| Barcode Labels | BARCODE-002 | Print barcode labels. | Labels render readable part name, barcode, and identifier without layout clipping. | Owner/Admin/Tech |
| Barcode Labels | BARCODE-003 | Change shipping/label printer preset. | Shop Settings supports 2.25 x 1.25 parts/bin, 4 x 6 thermal, and Letter/plain paper presets for label output. | Owner/Admin |
| Reports / Advanced Reporting | REPORT-001 | Open Advanced Reporting as Pro or Pro trial. | Reports dashboard is visible and shows real shop metrics/tables. | Owner/Admin |
| Reports / Advanced Reporting | REPORT-002 | Open Advanced Reporting as Shop/non-Pro. | Pro lock state appears and does not expose report data. | Owner/Admin |
| Reports / Advanced Reporting | REPORT-003 | Review Pro report sections. | Overview, status, priority, overdue, aging, low stock, PO, landed cost, and schedule sections match shop data. | Owner/Admin |
| Roles and Permissions | ROLE-001 | Test Viewer role. | Viewer can view allowed data but cannot create, edit, upload, delete, receive, or manage settings. | Viewer |
| Roles and Permissions | ROLE-002 | Test Tech role. | Tech can perform intended operational writes but cannot access operator-only controls. | Tech |
| Roles and Permissions | ROLE-003 | Test Owner/Admin settings access. | Owner/Admin can manage intended shop settings without seeing platform operator tools unless also an operator. | Owner/Admin |
| Roles and Permissions | ROLE-004 | Attempt operator dashboard access as non-operator. | Operator UI does not render and stale navigation cannot reopen it. | Owner/Admin/Tech/Viewer |
| Offline / Draft Behavior | OFFLINE-001 | Create a new job while offline or disconnected. | New job draft is saved locally with clear offline messaging. | Owner/Admin/Tech |
| Offline / Draft Behavior | OFFLINE-002 | Sync a local draft after reconnecting. | Draft syncs manually and creates a normal remote job. | Owner/Admin/Tech |
| Offline / Draft Behavior | OFFLINE-003 | Try existing-job or inventory edits while offline. | App clearly blocks unsupported offline edits instead of pretending they saved. | Owner/Admin/Tech |
| Mobile and Browser Testing | MOBILE-001 | Test mobile layout. | Main workflows remain usable on phone/tablet widths without overlapping controls. | Owner/Admin/Tech/Viewer |
| Mobile and Browser Testing | MOBILE-002 | Test older iPad/WebKit login. | Login page renders or shows readable unsupported-browser/debug messaging. | Owner/Admin/Tech/Viewer |
| Mobile and Browser Testing | MOBILE-003 | Test current desktop browser. | App loads and core workflows work in a modern desktop browser. | Owner/Admin/Tech/Viewer |
| Final Feedback | FEEDBACK-001 | Submit a bug with Report Issue or beta feedback channel. | Report includes what happened, expected result, role, browser/device, and relevant job/part/PO. | Any |
| Final Feedback | FEEDBACK-002 | Attach screenshot or video link for visual bugs. | The issue has enough visual evidence to reproduce or inspect. | Any |
| Final Feedback | FEEDBACK-003 | Complete final usability notes. | Tester records confusing areas, missing fields, blockers, and top requested fix. | Any |
