# Customer Import

FretTrack has a customer CSV import foundation for parsing, mapping, validation, duplicate detection, and skipped/error CSV output.

This is a preview/parser foundation only. It does not add an import modal, route, customer database writes, Supabase calls, XLSX support, vendor import, inventory import, or rollback behavior.

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

The isolated preview helper can:

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

Preview rows are classified as:

- `valid`
- `warning`
- `error`
- `duplicate`
- `skipped`

Each preview row includes the source row number, original row, mapped row, normalized row, status, errors, and warnings.

## Not Live Yet

Customer import does not write to the database yet. The Customers page does not expose an import UI in this phase.

Planned next phases:

1. Customers page preview-only importer for owners/admins.
2. Authenticated role smoke testing for owner, admin, tech, and viewer.
3. Write-enabled customer import after preview behavior is stable.
4. Later import batch history, rollback, XLSX support, vendor import, and inventory import.

## Validation

Run:

```bash
npm run check:customer-import
```

The check verifies template presence, parser behavior, alias mapping, first/last name combination, blank-row handling, validation, duplicate detection, issue CSV escaping, and that the preview helper does not import Supabase or customer persistence.
