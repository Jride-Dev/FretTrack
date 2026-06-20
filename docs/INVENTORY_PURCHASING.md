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

## Vendors

The vendor UI uses shop-friendly labels while preserving the original database column names:

- `vendors.name` displays as Company.
- `vendors.contact_name` displays as Sales Rep.

Vendor records can store email, phone, website, address line 1, address line 2, city, state/region, postal code, country, notes, active state, and Online Only state.

When Online Only is checked, FretTrack collapses the phone and address fields in the editor. Existing phone and address values are preserved unless a user manually clears them.

## Receiving

Manual receives and purchase order receives are written through transactional Supabase RPCs. A receive should create receipt history, update stock, update last cost, update average cost, and create a `part_movements` row together.

Purchase orders cannot be received when cancelled. Partial receives keep remaining quantities visible and move the purchase order to `partially_received`; full receives move it to `received`.

## Inbound Purchase Order Shipping And Landed Cost

Purchase orders support inbound vendor Shipping Cost. This is the cost paid to receive parts from a vendor. It is not customer/outbound shipping.

When Add shipping to cost is off, receiving uses the item unit cost normally and records no allocated shipping.

When Add shipping to cost is on, purchase-order receiving allocates only the remaining unallocated shipping for that purchase order across the current receipt lines using received line subtotal:

```text
line subtotal = quantity_received * unit_cost
line shipping share = remaining_shipping * (line subtotal / current_receipt_subtotal)
landed unit cost = unit_cost + (line shipping share / quantity_received)
```

If the current receipt subtotal is `0`, shipping allocated is `0` and landed unit cost remains the item unit cost.

Receipt items store base unit cost, shipping allocated, and landed unit cost. Parts `last_cost`, `average_cost`, receipt `unit_cost`, and receive movements use landed unit cost when shipping is added to cost.

Partial receipts do not double-count shipping. FretTrack calculates remaining shipping as:

```text
purchase_orders.shipping_cost - sum(existing inventory_receipt_items.shipping_allocated for the PO)
```

Then it allocates only that remaining amount to the current receipt.

## Purchase Order Item Part Linkage

Purchase order item rows should not live as free-text purchasing data only.

When a user creates a PO line from an existing inventory part, FretTrack links `purchase_order_items.part_id` to that existing `parts.id` and does not create a duplicate part.

When a user creates a PO line for a new part, FretTrack creates a real `parts` row immediately with `quantity_on_hand = 0`, links the PO item to that new part, and lets the existing barcode trigger assign `barcode_code`. The part should appear in inventory search and barcode label selection before it is received.

Receiving the PO increases the linked part quantity, updates cost fields, writes receipt history, and creates a `part_movements` row with `movement_type = receive`.

Older PO items that were created before this rule may still have `part_id = null`. The receive RPC repairs those rows by creating and linking a part during receive when the PO item has enough description data. If it cannot safely create or link a part, receiving fails with a clear error instead of silently skipping inventory stock.

## Future Shipping Scope

Inbound purchase-order shipping cost and landed-cost allocation are implemented for vendor purchase orders.

Future outbound customer shipping may include customer shipping charges, carrier/rate integrations, labels, tracking numbers, shipment status, SMS/email shipment notifications, and Pro tier or paid add-on packaging.
