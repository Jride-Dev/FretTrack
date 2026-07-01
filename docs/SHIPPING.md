# Shipping Foundation

FretTrack currently separates two kinds of shipping work:

- **Inbound vendor / purchase-order shipping:** already implemented in Inventory Purchasing. Purchase orders can store inbound vendor shipping cost, optionally allocate it into landed cost, and show that allocation in purchase history.
- **Outbound job / customer shipping:** database and service foundation exists, but no user-facing UI is wired in yet.

## Outbound Job Shipping Foundation

The shipping foundation adds `public.job_shipments` as the future home for job-level outbound/customer shipment records.

Shipment records are shop-scoped and linked to:

- `shop_id`
- `job_id`
- optional `customer_id`

Shipment records also store a ship-to address snapshot. This is intentional: customer addresses can change, but shipment history needs to remain accurate for the destination used at the time of shipping.

## Current Fields

The foundation supports:

- direction: `inbound`, `outbound`, `customer_return`
- fulfillment method: `pickup`, `ship`
- status: `not_ready`, `ready_to_ship`, `label_needed`, `shipped`, `delivered`, `returned`, `problem`, `void`
- carrier, service level, tracking number, and optional tracking URL
- ship-to name and address snapshot fields
- internal shipping cost and customer shipping charge
- notes, shipped timestamp, delivered timestamp, creator, created timestamp, and updated timestamp

## Permissions

Phase 1 follows the existing shop access model:

- Owner/Admin/Tech can create and update shipment records while the shop has write access.
- Owner/Admin can void shipments.
- Viewer is read-only.
- Expired or read-only shop lifecycle states block shipment writes.

Backend RLS uses existing shop membership and write-access helpers. Normal users do not get hard-delete access; the intended deletion path is a future `void` status.

## What Is Not Included Yet

This foundation does not add:

- shipping UI
- carrier APIs
- label/rate purchasing
- Stripe or payment integration
- shipment email/SMS automation
- shipping reports
- offline shipping sync

## Label Printer Preset Foundation

Shop Settings now includes a shipping/label printer preset under Inventory / Vendor Controls:

- `2.25 x 1.25 parts/bin label`
- `4 x 6 thermal shipping label`
- `Letter / plain paper`

The current use is the browser-based inventory barcode label sheet. This is a settings/UI foundation only; it does not create carrier labels, rates, postage, tracking purchases, or carrier API calls.

## Planned Next Phase

The next practical pass should add a small Job Detail shipping card:

- choose Pickup or Ship
- prefill ship-to data from the job/customer
- manually enter carrier, service, tracking number, tracking URL, cost, charge, notes, and status
- show shipment history for the job

Reports, printable customer-facing shipping details, shipment notifications, labels, rates, and carrier integrations should remain later phases.
