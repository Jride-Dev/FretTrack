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

## Purchase Order Item Part Linkage

Purchase order item rows should not live as free-text purchasing data only.

When a user creates a PO line from an existing inventory part, FretTrack links `purchase_order_items.part_id` to that existing `parts.id` and does not create a duplicate part.

When a user creates a PO line for a new part, FretTrack creates a real `parts` row immediately with `quantity_on_hand = 0`, links the PO item to that new part, and lets the existing barcode trigger assign `barcode_code`. The part should appear in inventory search and barcode label selection before it is received.

Receiving the PO increases the linked part quantity, updates cost fields, writes receipt history, and creates a `part_movements` row with `movement_type = receive`.

Older PO items that were created before this rule may still have `part_id = null`. The receive RPC repairs those rows by creating and linking a part during receive when the PO item has enough description data. If it cannot safely create or link a part, receiving fails with a clear error instead of silently skipping inventory stock.

## Future Shipping Scope

Inbound purchase-order shipping cost and landed-cost allocation are planned for a separate inventory cost pass.

Outbound customer shipping charges, carrier labels, tracking numbers, and shipping SMS/email notifications are future Pro/add-on scope.
