# Accounting Module Inspection

FretTrack already has two money-tracking paths:

- Live work-order billing lives on jobs: `parts`, `services`/`labor`, `techDetails.tax`, `techDetails.payments`, and job discount fields.
- The commerce backbone is present but mostly dormant: `transaction_events`, `payment_events`, `tax_profiles`, `payment_methods`, and `inventory_movements`.

The commerce backbone is append-only. `transaction_events`, `payment_events`, and `inventory_movements` have mutation-prevention triggers, and `20260514035528_shop_scope_rls_audit.sql` replaces the original public read policies with authenticated shop-member policies. Transaction creation is guarded by `private.can_write_shop(...)`.

For this beta accounting module, reports should derive from the current shop-scoped job data and preserve the event-table direction for later integration. This avoids turning the app into a general ledger while still giving owners clean daily/monthly/yearly summaries, payments by method, tax collected, and open balances.

Important constraints carried into implementation:

- Every selector accepts a `shopId` and filters jobs to that shop.
- Tax snapshots are built from the job's saved tax settings: rate, jurisdiction/state, taxable subtotal, non-taxable subtotal, and tax amount.
- Parts revenue and internal part cost are tracked separately. Customer-facing exports must not include internal cost unless the export is explicitly marked internal.
- Refunds, voids, and adjustments are represented as accounting events/rows. Existing payment or transaction history should not be deleted for reporting cleanup.
- This remains operational tax-prep support, not payroll, reconciliation, balance sheet, depreciation, filing, or 1099 software.
