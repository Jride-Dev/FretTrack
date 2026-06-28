# Customer CSV Import

Customer CSV Import MVP lets shop owners and admins bring an existing customer list into the active FretTrack shop.

This is a paid-beta onboarding feature for customer records only. It does not import vendors, inventory parts, purchase orders, job history, photos, XLSX workbooks, or Stripe/billing data.

## Access

- Owners can import customers.
- Admins can import customers.
- Techs and viewers cannot import customers.
- Expired or read-only shop access blocks imports.

The frontend hides the import entry point from tech and viewer roles. Imports still use the normal customer save path and Supabase RLS; no service-role key is used in browser code.

## Template

Download the template from:

```text
/templates/frettrack-customer-import-template.csv
```

Template columns:

```csv
name,email,phone,address,notes
```

Accepted aliases include:

- `customer_name`, `full_name`, `first_name`, `last_name`
- `email_address`
- `phone_number`, `mobile`
- `street_address`
- `notes`

When `first_name` and `last_name` are provided without `name`, FretTrack combines them into the customer display name.

## Import Flow

1. Open Customers.
2. Select Import Customers.
3. Download the CSV template if needed.
4. Upload a `.csv` file.
5. Review or adjust column mappings.
6. Review the preview and validation results.
7. Confirm the import.
8. Download skipped/error rows if cleanup is needed.

FretTrack never imports the file without confirmation.

## Validation

Each row is trimmed and validated locally before import.

Required:

- `name`, or usable `first_name` / `last_name`

Optional:

- `email`
- `phone`
- `address`
- `notes`

Rows are classified as:

- `Ready`: can import.
- `Warning`: can import, but follow-up data such as email or phone may be missing.
- `Duplicate`: skipped by default.
- `Error`: skipped.

Completely blank rows are ignored.

Invalid email addresses are errors. Missing customer names are errors even if the row has an email or phone number.

## Duplicate Behavior

The MVP does not auto-merge or overwrite customers.

FretTrack warns and skips likely duplicates by default when a row matches:

- another row in the uploaded CSV
- an existing customer by email
- an existing customer by phone
- an existing customer by name + phone
- an existing company by company + email where existing customer data supports it

Skipped duplicate and error rows can be downloaded as a CSV for cleanup.

## Import Metadata

Each confirmed import gets one UUID `import_batch_id`.

Imported customers are saved with:

```text
import_source = csv
import_batch_id = <generated UUID>
```

These fields already exist in the customer schema. This MVP does not add a new migration.

## Current Limits

- CSV only.
- XLSX import is not supported yet.
- No rollback button yet.
- No separate import batch table yet.
- No vendor import yet.
- No inventory part import yet.
- No purchase order or historical job import yet.

Future import work should add import batch history, rollback support, owner/admin backend RPC enforcement, reusable templates for vendors and inventory, and optional XLSX support after CSV behavior is stable.
