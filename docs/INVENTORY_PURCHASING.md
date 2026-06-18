# Inventory Purchasing Notes

## Barcode Labels

Inventory parts use a stable barcode identity:

```text
FT-PART-{barcode_code}
```

The barcode identity is for lookup only. It does not encode price, cost, quantity on hand, reorder levels, or other mutable stock data.

To print labels:

1. Open Inventory.
2. Select one or more parts in the Parts tab.
3. Open Barcode Labels.
4. Print the preview sheet from the browser.

Labels include the barcode, part name, optional SKU or part number, and location/bin when available.

## Receiving

Manual receives and purchase order receives are written through transactional Supabase RPCs. A receive should create receipt history, update stock, update last cost, update average cost, and create a `part_movements` row together.

Purchase orders cannot be received when cancelled. Partial receives keep remaining quantities visible and move the purchase order to `partially_received`; full receives move it to `received`.
