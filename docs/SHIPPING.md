# Shipping / Receiving / Chain of Custody

FretTrack shipping is manual operational tracking. It is not a carrier label, postage, or rate-shopping system.

Shops should keep buying labels and managing carrier accounts in their own shipping tools. FretTrack stores the repair-shop side of the workflow: what arrived, what is checked in, where it sits, what is packed, what tracking number was used, and what custody events happened along the way.

## Current Scope

The current foundation supports:

- vendor inbound receiving records
- customer inbound repair shipments
- customer outbound returns
- vendor returns
- inventory outbound shipments
- internal transfer tracking
- manual carrier, service, tracking number, and tracking URL fields
- manual label reference and label/document URL placeholders
- declared value, insurance required, and signature required fields
- shipping cost and customer shipping charge fields
- received condition, condition notes, packing notes, and internal notes
- customer-notified status
- item-level destination/disposition tracking
- timestamped custody events

The app includes a Shipping dashboard with these operational groups:

- Pending Arrival
- Arrived / Needs Check-In
- At Bench
- Ready to Ship
- In Transit
- Exceptions

## Data Model

Shipping records live in `public.job_shipments`. The table originally started as outbound job shipping, and now supports broader shipment/custody records.

Records are shop-scoped and may link to:

- `job_id`
- `customer_id`
- `vendor_id`
- `purchase_order_id`

`job_id` is optional so vendor inbound, inventory outbound, and internal transfer records can exist before or without a repair job.

`public.shipping_items` stores item/package details linked to a shipping record. Items can represent instruments, parts, accessories, packages, or other shop-handled items.

`public.custody_events` stores timestamped custody history for shipping records and items. Events are recorded when shipments are created, items are received, statuses change, locations/categories are assigned, items are assigned to a user/bench, records are packed, shipped, delivered, or marked as exceptions.

## Location And Category Presets

Shipping and receiving reuse the existing Shop Settings inventory preset fields:

- `shop_profiles.inventory_location_presets`
- `shop_profiles.inventory_category_presets`

There is no duplicate shipping location/category system. Preset values are display labels and may contain spaces.

Known valid examples:

- `Black Bag`
- `Plastic Bin`
- `White top drawer`
- `Guitar Parts`

The migration and UI trim leading/trailing whitespace only. They do not split on whitespace, slugify, or rewrite display values.

## Permissions

Shipping follows the existing shop access model:

- Owner/Admin/Tech can create and update shipping and custody records while the shop has write access.
- Viewer can read shipping and custody records only.
- Expired or read-only shop lifecycle states block shipping writes.
- Backend RLS uses existing shop membership and write-access helpers.
- Normal users do not get hard-delete access.

## Inventory And Purchase Orders

Inbound vendor purchase-order shipping cost and landed-cost allocation still live in Inventory Purchasing.

The Shipping dashboard can link a manual inbound shipping/custody record to a vendor and purchase order, but it does not replace the transactional purchase-order receiving RPCs that increase stock, write receipt history, update costs, and create `part_movements`.

## Not Included

This phase intentionally does not add:

- FedEx, UPS, USPS, DHL, ShipStation, Pirate Ship, or other carrier APIs
- label purchase
- rate shopping
- postage purchase
- automatic tracking lookups
- automatic shipment emails or SMS
- Stripe payment automation
- shipping reports or exports
- offline shipping sync

## Future Work

Likely future phases:

- Job Detail shipping card
- printable customer-facing ship-back summary
- customer communication templates for manual tracking updates
- shipping reports for ready-to-ship, in-transit, delivered, and exception records
- shipping cost vs charge reporting
- optional carrier integrations after the manual workflow is stable
