# Customer and Subcontractor Module Plan

## What Was Added

- Customer list with search and filters for type, balance, and active status.
- Customer profile view with job history, payment history, balance summary, and notes.
- Customer edit flow for contact details, business info, tax ID, and active/inactive state.
- Subcontractor/business profiles that can be used as real records instead of only intake names.
- Create-job-from-customer workflow that pre-fills new intake jobs from a customer profile.
- Balance summaries calculated from existing job totals and payment data.

## Known Limitations

- Balance data is derived from job records and payments already stored on each job.
- Existing subcontractor names in older jobs are surfaced when the customer type is subcontractor, but the app does not retroactively rewrite old job data.
- This is not a full CRM replacement yet. No sales pipeline, reminders, or communication timeline has been added.
- Statement-generation and export tooling still belong to the accounting/export roadmap.

## Future Import And Merge Work

- Bulk customer import preview and duplicate resolution.
- Merge customers and reconcile duplicate history safely.
- Stronger matching for company/subcontractor records across older jobs.
- Optional import of tax/business identifiers from CSV files.

## Future Statement And Export Support

- Customer statements showing billed, paid, and outstanding balance by date range.
- Customer-level CSV/PDF export for jobs and payments.
- Subcontractor statement/export flows for jobs owed and amounts paid.
- Optional aging buckets for open balances.
