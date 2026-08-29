# Shop Localization and Current Jobs

FretTrack 0.3.0 includes persistent shop-level localization and a full Current Jobs workspace. The implementation incorporates practical workflow feedback from Aleks at Sell Us Your Guitar.

## Shop Settings

Owners and admins can configure these values in Shop Settings:

- Country / region: United States, United Kingdom, or Canada
- Measurement system and action length unit
- Currency: USD, GBP, or CAD
- Tax label, including Sales Tax, VAT, GST, or custom wording
- Default tax percentage for new jobs

Country selection can offer predictable regional suggestions. Choosing United Kingdom suggests metric measurements in millimetres, GBP, `en-GB`, and VAT wording. The percentage remains blank unless the shop enters one. Shops can decline the suggestions and retain explicit overrides, and saved overrides are not repeatedly replaced.

Settings are persisted on the active, RLS-protected `shop_profiles` row. Country uses `country_code`; measurement uses `measurement_system` and `length_unit`; currency and locale use `currency_code` and `locale`; tax wording and rate use `tax_label` and the existing `sales_tax_rate`. Each read and write is scoped by `shop_id`.

New jobs snapshot the shop defaults used for their tax, currency, date, and measurement context. Changing Shop Settings does not convert monetary values, rewrite historical measurements, or silently recalculate existing job totals.

FretTrack does not provide exchange-rate conversion and does not decide the legally correct tax rate, registration status, exemptions, or VAT treatment. Shops remain responsible for their tax, accounting, legal, and customer obligations.

## Current Jobs

The compact sidebar remains a quick active-jobs summary and links to **View all current jobs**. The full Current Jobs page uses the main content width and supports:

- search by job number, customer, instrument, brand, model, or serial
- priority, status, overdue, due-soon, and active/all scope filters
- priority, date received, due date, job number, and status sorting
- direct keyboard, mouse, or touch opening of the existing Job Detail workflow

Active jobs are the default. Completed, picked-up, cancelled, and archived jobs are available only when the scope is broadened. On narrow screens, each result becomes a contained two-column card.
