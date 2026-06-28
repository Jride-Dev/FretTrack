# Customer Import

FretTrack has a customer CSV import foundation for parsing, mapping, validation, duplicate detection, and skipped/error CSV output.

The Customers module now includes an Owner/Admin-only CSV Import Preview panel. This is still preview only. It does not add customer database writes, Supabase calls, XLSX support, vendor import, inventory import, or rollback behavior.

## Template

The starter CSV template lives at:

```text
/templates/frettrack-customer-import-template.csv
```

Template columns:

```csv
name,email,phone,address,notes
```

Accepted aliases include:

- `customer_name`
- `full_name`
- `first_name`
- `last_name`
- `email_address`
- `phone_number`
- `mobile`
- `street_address`
- `notes`

If `first_name` and `last_name` are present but `name` is not, the preview helper combines them into the normalized customer name.

## Current Behavior

The preview helper and Customers page panel can:

- parse CSV text with quoted values, commas, and multiline cells
- normalize headers
- auto-map known customer columns
- ignore blank rows
- normalize row values
- require a customer name or first/last name
- validate email format when email is present
- detect duplicate rows inside the uploaded file
- warn about likely duplicates against supplied existing customer records
- prepare skipped/error CSV output
- cap the visible preview table at 100 rows
- block preview for CSV files with more than 1,000 nonblank rows

Preview rows are classified as:

- `valid`
- `warning`
- `error`
- `duplicate`
- `skipped`

Each preview row includes the source row number, original row, mapped row, normalized row, status, errors, and warnings.

## Access

Owners and admins can open the preview panel from Customers. Tech and viewer roles cannot access the preview entry point. Expired or read-only lifecycle states do not allow customer import preview actions.

## Not Live Yet

Customer import does not write to the database yet. The preview panel has no save/import action.

Planned next phases:

1. Authenticated role smoke testing for owner, admin, tech, and viewer.
2. Write-enabled customer import after preview behavior is stable.
3. Later import batch history, rollback, XLSX support, vendor import, and inventory import.

## Validation

Run:

```bash
npm run check:customer-import
```

The check verifies template presence, parser behavior, alias mapping, first/last name combination, blank-row handling, validation, duplicate detection, issue CSV escaping, and that the preview helper does not import Supabase or customer persistence.
