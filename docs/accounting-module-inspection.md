# Accounting Module Inspection

FretTrack already has two money-tracking paths:

- Live work-order billing lives on jobs: `parts`, `services`/`labor`, `techDetails.tax`, `techDetails.payments`, and job discount fields.
- The commerce backbone is present but mostly dormant: `transaction_events`, `payment_events`, `tax_profiles`, `payment_methods`, and `inventory_movements`.

The commerce backbone is append-only. `transaction_events`, `payment_events`, and `inventory_movements` have mutation-prevention triggers, and `20260514035528_shop_scope_rls_audit.sql` replaces the original public read policies with authenticated shop-member policies. Transaction creation is guarded by `private.can_write_shop(...)`.

For the stable 0.3.0 accounting module, reports derive from current shop-scoped job data and preserve the event-table direction for later integration. This avoids turning the app into a general ledger while still giving owners clean daily/monthly/yearly summaries, payments by method, tax collected, and open balances.

Important constraints carried into implementation:

- Every selector accepts a `shopId` and filters jobs to that shop.
- Tax snapshots are built from the job's saved tax settings: rate, jurisdiction/state, taxable subtotal, non-taxable subtotal, and tax amount.
- Parts revenue and internal part cost are tracked separately. Customer-facing exports must not include internal cost unless the export is explicitly marked internal.
- Refunds, voids, and adjustments are represented as accounting events/rows. Existing payment or transaction history should not be deleted for reporting cleanup.
- Accounting-excluded work orders remain stored and read-only. They are omitted from operational accounting and job metrics, while their customer, parts, services, messages, payment adjustments, and audit events remain available.
- This remains operational tax-prep support, not payroll, reconciliation, balance sheet, depreciation, filing, or 1099 software.

## Accounting-safe work-order exclusion

Migration `20260828022147_accounting_safe_job_void.sql` adds the owner/admin-only `set_job_accounting_void` boundary. It locks the work order, rechecks shop lifecycle state, requires a reason, rejects a nonzero payment ledger or an erased historical payment, and records exclusion/restoration in `job_events`. Excluded work orders cannot be changed through ordinary job updates. The UI provides explicit Refund and Payment Void rows so staff can preserve the financial trail instead of deleting a payment to make totals look clean.

The application excludes these records from Accounting / Reports, till summaries, advanced operational metrics, and current-job counts. Loyalty awards are deactivated and unsent service reminders are canceled while the source work order is excluded.
