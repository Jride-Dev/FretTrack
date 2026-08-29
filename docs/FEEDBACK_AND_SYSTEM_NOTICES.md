# Feedback And System Notices

## System notices

Use `system_announcements` for time-bounded maintenance, service degradation, or important shop-specific notices. Notices may be global or scoped to one shop and support `info`, `warning`, and `urgent` severity values.

Do not use announcements for marketing email or to expose internal incident details. Keep the title and message useful to shop staff and include an end time when known.

## In-app issue reports

Signed-in users can select **Report Issue** in the app header. A report records the shop, user, current page, browser context, and selected work order when available. The underlying `beta_feedback` table name is retained as a database compatibility identifier; the product UI calls this **Report Issue**.

Issue statuses are `new`, `triaged`, `fixed`, `deferred`, and `closed`. Avoid storing passwords, API keys, payment-card data, or unnecessary customer information in reports.
