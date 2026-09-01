# Inventory Purchasing Notes

## Current 0.3.1 Scope

Current inventory documentation covers the purchasing and specialist-workflow foundation included in stable 0.3.1:

- parts catalog, stock counts, reorder levels, low-stock visibility, and job-part usage/returns
- shop-scoped vendors with Company/Sales Rep labels, address fields, and Online Only behavior
- purchase orders, purchase-order items, partial/full receiving, and purchase history
- transactional receiving RPCs that keep stock, receipts, costs, purchase-order status, and part movements in sync
- stable `FT-PART-{barcode_code}` identities and printable barcode label sheets
- inbound purchase-order Shipping Cost and optional landed-cost allocation
- shop-defined inventory Location and Category presets managed from Shop Settings
- Special Order Part handling for non-stocked items
- small part-image attachment support using the private `part-images` Storage bucket

Inventory receiving and purchase-order work remain online-only until a future offline sync/outbox design exists.

## Purchase units and inventory units

Inventory parts may optionally describe how a vendor sells the item with a Purchase Unit and a positive whole-number Units per Purchase Unit value. Existing parts default to Each and 1. Purchase-order quantities and partial receipts are entered in purchase units, while stock adjustments and job usage remain individual inventory units.

Purchase entry separates three values: the number of complete packages ordered, the number of individual items inside one package, and the vendor price for one whole package. For example, one five-pack priced at $19.40 is entered as 1 Pack, 5 items inside, and $19.40 for the whole Pack. The purchase-order vendor charge remains $19.40 and FretTrack derives a $3.88 inventory-each valuation. The exact package price is stored separately so it is not reconstructed by multiplying a rounded per-item cost.

Each purchase-order line and receipt stores the conversion used at the time of the transaction. Editing a part from a 12-pack to a 10-pack later does not reinterpret an older order or receipt. Receiving two saved 12-packs adds 24 individual units to stock.

## Shop Inventory Presets

Shop owners/admins can manage Inventory Locations and Inventory Categories in Shop Settings under Inventory / Vendor Controls.

The Parts editor uses dropdowns populated from those shop presets and also includes any old saved text values from existing parts. This preserves historical location/category data while nudging new entries toward consistent shop-defined values.

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

Labels include the barcode, part name, optional UPC or part number, and location/bin when available.

Shop Settings also includes a shipping/label printer preset used by the current browser-based barcode label sheet:

- `2.25 x 1.25 parts/bin label`
- `4 x 6 thermal shipping label`
- `Letter / plain paper`

These are print-layout preferences only. FretTrack does not buy carrier labels or call carrier APIs in this pass.

## UPC And Vendor Wording

The inventory UI now uses UPC-facing labels for the existing part identifier fields:

- `parts.sku` displays as UPC.
- `purchase_order_items.vendor_sku` and the matching part field display as Vendor UPC.

The database column names are intentionally preserved for compatibility with legacy data and migrations.

## Vendors

The vendor UI uses shop-friendly labels while preserving the original database column names:

- `vendors.name` displays as Company.
- `vendors.contact_name` displays as Sales Rep.

Vendor records can store email, phone, website, address line 1, address line 2, city, state/region, postal code, country, notes, active state, and Online Only state.

When Online Only is checked, FretTrack collapses the phone and address fields in the editor. Existing phone and address values are preserved unless a user manually clears them.

## Special Order Parts

Parts can be marked as Special Order Part when they are not normal stocked inventory.

Special-order parts:

- remain usable on jobs
- remain usable on purchase orders and receiving
- do not count as low-stock stocked items
- ignore Desired Stock Level and save it as `0`

Normal stocked parts keep the existing Desired Stock Level, Reorder Point, low-stock, receiving, adjustment, and job-usage behavior.

## Part Images

Inventory parts can store one small reference image.

Rules:

- The image must already be 300x300 px or smaller.
- FretTrack rejects larger images with a clear error.
- FretTrack does not resize, compress, convert, or edit inventory part images.
- Images are stored in the private `part-images` Supabase Storage bucket under a shop-scoped path.
- Part rows store image path, MIME type, width, and height metadata.

## Receiving

Manual receives and purchase order receives are written through transactional Supabase RPCs. A receive should create receipt history, update stock, update last cost, update average cost, and create a `part_movements` row together.

After a direct receive, manual stock adjustment, or purchase-order receipt, the Inventory controller refreshes the selected editor's authoritative quantity and cost from the saved part while preserving unrelated unsaved fields. This prevents a later Save Changes action from overwriting the stock mutation with a stale form quantity.

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

## Specialist Work Order Purchasing Bridge

Pro amplifier and keyboard benches can create an ordered vendor purchase order that is linked to the source work order. The line may reuse an active shop inventory part or create an active special-order part with zero stock. Keyboard lines can also bind one open keyboard parts request to the purchase-order item.

Vendor purchasing quantity is deliberately separate from customer-job quantity. For example, one vendor Set may receive two inventory units while the linked repair bills one unit. Inventory receiving handles the full purchased package and ordinary stock/cost history; **Add to Parts & Payments** transfers only the saved `job_quantity` to the linked work order.

Migration `20260822033718_specialist_purchasing_bridge.sql` adds the job, job quantity, fulfillment part, keyboard request, and idempotency links plus guarded creation and fulfillment RPCs. Purchase creation serializes calls sharing the same request key and returns the already-created order to a concurrent retry. Fulfillment requires a received item and returns the existing `job_parts` row on retry. The application refreshes the app-level selected job after fulfillment so the part and billing totals are visible immediately in the shared commercial workspace.

## Future Shipping Scope

Inbound purchase-order shipping cost and landed-cost allocation are implemented for vendor purchase orders.

Future outbound customer shipping may include customer shipping charges, carrier/rate integrations, labels, tracking numbers, shipment status, SMS/email shipment notifications, and Pro tier or paid add-on packaging.
