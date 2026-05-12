# Commerce Backbone

FretTrack's commerce backbone is the foundation for future inventory, purchasing, payments, closeout, and tax handoff features. It is intentionally not a full accounting system. The goal is to capture clean operational records that a shop can review, export, and take to its tax professional or accounting package.

## Architecture Goals

- Keep current trial MVP flows working: jobs, customers, instruments/assets, services, parts, photos, print, and shop settings remain the product focus.
- Store money in minor units for commerce events, such as cents or pence, instead of floating point display values.
- Keep commerce generic enough for guitars, amps, orchestral instruments, electronics, bikes, and other repair industries.
- Generate transaction numbers in the database so two clients cannot create the same number.
- Keep payment methods, currencies, and tax profiles configurable data instead of hardcoded UI lists.
- Add modules incrementally without rewriting the work-order system.

## Ledger Philosophy

Commerce records should describe what happened, not constantly rewrite what used to be true. A sale, payment, refund, inventory adjustment, or vendor return becomes an event. Reports then summarize those events for a date range, location, till, customer, job, or shop.

This gives future reports a stable source of truth while allowing FretTrack to stay lighter than accounting software. The app should answer operational questions like:

- What money came in today?
- Which transactions affected this work order?
- Which parts moved in or out of inventory?
- What inventory value snapshot should the shop review at year end?
- What should be exported for a bookkeeper or tax preparer?

## Append-Only Event Strategy

The core tables are designed as append-only records:

- `transaction_events`
- `payment_events`
- `inventory_movements`

Updates and deletes are blocked by database triggers. Corrections should be entered as compensating events, such as a reversal or adjustment, so the history remains auditable.

`transaction_events.transaction_number` is assigned by the database through `create_transaction_event(...)`. Numbers are unique within a shop/location scope and are not generated in the frontend. The display layer can pad them as `000001`, `000002`, and later allow seven or eight digits naturally as the sequence grows.

## Core Tables

- `currencies`: configurable currency metadata such as code, symbol, minor unit, and locale hint.
- `tax_profiles`: lightweight jurisdiction/rate configuration for future reporting. This is not a tax engine.
- `payment_methods`: configurable tender methods such as cash, card, check, account, store credit, or later outside finance.
- `transaction_number_sequences`: database-owned sequence state scoped by shop and location.
- `transaction_events`: immutable financial event records with source references and minor-unit totals.
- `payment_events`: payment-specific detail linked to a transaction event.
- `inventory_movements`: inventory event records using `IN`, `OUT`, `ADJUSTMENT`, `RETURN`, `DAMAGED`, `LOST`, and `FOUND`.

## Future Integration Points

- Work orders can create transaction events when parts, payments, deposits, refunds, or final totals are committed.
- Inventory can create movements when parts are received, sold, adjusted, damaged, lost, found, or returned to a vendor.
- Purchasing can link purchase orders, receiving orders, and vendor returns to inventory movements.
- End-of-day reports can summarize transaction and payment events by location, till, tender type, tax profile, and employee.
- End-of-year and quarterly exports can summarize closed work, open liabilities, payments, taxes collected, and inventory value snapshots without turning FretTrack into accounting software.

## Current Boundary

This backbone is deliberately dormant until future modules use it. It does not replace the current job totals, payments array, parts rows, or trial workflows yet. The next step is to integrate one narrow flow at a time, starting with transaction creation around committed payments or work-order closeout.
