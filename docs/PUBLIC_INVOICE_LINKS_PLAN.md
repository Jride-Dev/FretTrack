# Public Invoice Links Plan

Date: 2026-06-02

Scope: planning only for `v0.2.6-beta.12`. Do not implement from this document directly without a fresh security review.

## Summary

FretTrack should support a paid add-on that lets a shop generate a secure public invoice or work-order link that can be placed on the shop's website or sent directly to a customer by email or text.

This is intentionally not part of the normal paid tier. It should be treated as a premium add-on because it creates a public-facing document surface, introduces tokenized external access, and will eventually connect to payment collection.

The main design rule is simple:

- private shop workflow stays inside authenticated FretTrack
- public invoice access uses a separate, minimal, view-only document path
- no internal shop data leaks into the public route

## 1. Use Cases

Primary use cases:

- A customer clicks an invoice/work-order link from a repair shop website.
- A shop sends a direct invoice URL by email or SMS from inside FretTrack or an external message.
- A customer views current balance due without signing in.
- A customer sees a clean work-order summary with safe, customer-facing repair details.
- A shop uses the same public link in printed paperwork, QR codes, or website buttons later.

Near-term supported experience:

- View-only invoice/work-order page
- Shop branding/header
- Balance due
- Customer-safe job summary

Future expansion:

- Stripe payment link or embedded payment flow
- customer self-service portal
- SMS invoice links
- custom domain or embedded website widget
- QR code printed on invoice or job sheet

## 2. Product Positioning

This should be positioned as:

- a paid add-on
- premium/public-facing workflow
- useful for higher-touch shops that want website-connected customer communication

This should not be required for normal shop operation. Shops must still be able to:

- email normal invoice summaries
- print invoices
- collect payments manually
- run core repair workflow without public links

## 3. Security Model

Public invoice links must be treated as external access tokens, not as public job pages.

Required security properties:

- no guessable job IDs in the URL
- use a signed random token or secure UUID-like slug with high entropy
- store only a token hash server-side if practical
- allow expiration
- allow revocation
- support regeneration
- never expose private admin-only or internal-only fields
- keep the public route read-only
- add rate limiting
- log views without exposing management data

Recommended link shape:

- `https://app.frettrack-app.com/public/invoice/<token>`

Avoid:

- query strings with `job_id`
- sequential link IDs
- anything derived directly from shop name, job number, or customer email

Recommended token approach:

1. Generate a strong random token server-side.
2. Store only a hash of the token in the database if implementation effort is reasonable.
3. Send the raw token to the shop once at creation time.
4. Resolve incoming requests by hashing the presented token and matching the stored hash.

If hashing is deferred for implementation simplicity, the fallback must still use:

- a long cryptographically random token
- immediate revocation support
- strict TTL support

But hashing is preferred for the real implementation.

### Public Route Rules

The public document route must:

- require no login
- return only the minimal public invoice payload
- never use client-side filtering as the primary privacy boundary
- never expose shop admin controls
- never expose raw database IDs that are useful elsewhere
- never allow edits

### Data Exposure Rules

Allowed public data:

- shop name
- shop logo/branding if enabled
- job number
- customer display name only if necessary
- instrument summary
- customer-facing status
- service and part line items that belong on the invoice
- subtotal, tax, total, payments, balance due
- safe pickup/payment note

Do not expose:

- internal notes
- bench-only notes
- employee-only comments
- cost fields
- supplier/vendor references
- hidden draft line items
- raw customer contact details beyond what is necessary
- private photos unless explicitly designed as public-safe later

### Expiration and Revocation

Each public link should support:

- no expiry, if the shop chooses it and the plan allows it
- fixed expiry date/time
- revoked status
- regenerated replacement token

Expected behavior:

- revoked link: public route shows invalid/unavailable state
- expired link: public route shows expired state
- regenerated link: old token fails, new token works

### Rate Limiting

Public document access should be rate-limited separately from normal logged-in app requests.

Minimum plan:

- basic per-IP request throttling
- optional burst limit by token
- view logging with timestamp and count

Future hardening:

- bot protection
- abuse monitoring for high-view tokens
- suspicious repeated access alerts for operators

## 4. Data Model

Recommended new table:

`public_invoice_links`

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `shop_id text not null references shop_profiles(shop_id) on delete cascade`
- `job_id uuid not null references jobs(id) on delete cascade`
- `token_hash text not null`
- `status text not null default 'active'`
- `expires_at timestamptz`
- `created_by uuid references auth.users(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `last_viewed_at timestamptz`
- `view_count integer not null default 0`

Recommended status values:

- `active`
- `revoked`
- `expired`

Optional later columns:

- `label text` for operator note like "Website footer link"
- `last_viewed_ip inet` if privacy policy and storage posture support it
- `public_title text` for customer-facing naming
- `payment_provider_link text`

### Why per-link records matter

This should not be derived from jobs alone because links need independent lifecycle:

- multiple links per job may be useful later
- link expiry is separate from job status
- revocation must not affect the job record itself
- view analytics belong to the public link, not the job

## 5. RLS and Access Pattern

New public-link data should not rely on normal app-table RLS alone because the public route is anonymous.

Recommended split:

1. Authenticated shop management path
   - owners/admins create/revoke/regenerate through RPC or Edge Function
   - RLS allows owners/admins to read their own shop's link records
2. Public resolution path
   - anonymous/public request resolves through a tightly scoped RPC or Edge Function
   - returns only a sanitized public document payload

Do not:

- grant anonymous direct select on `jobs`
- grant anonymous direct select on `public_invoice_links`
- expose public links by opening up general table reads

Recommended server-side pattern:

- `create_public_invoice_link(target_job_id uuid, expires_at timestamptz, ...)`
- `revoke_public_invoice_link(target_link_id uuid)`
- `regenerate_public_invoice_link(target_link_id uuid)`
- `resolve_public_invoice_link(raw_token text)`

`resolve_public_invoice_link` should:

- validate active status
- validate expiry
- validate shop/job relationship
- increment `view_count`
- update `last_viewed_at`
- return sanitized public payload only

## 6. Entitlements and Add-On Gating

This feature must be gated as an add-on entitlement, not as a normal included feature.

Recommended new entitlement key:

- `public_invoice_links`

Optional supporting entitlements later:

- `public_invoice_links_max_active`
- `public_invoice_links_custom_branding`
- `public_invoice_links_payments`

Rules:

- generation must be blocked server-side if the shop lacks the entitlement
- revocation/regeneration/management should also be server-validated
- no frontend-only gating
- public viewing of already-generated active links should still work even if a shop later loses access, unless policy says active add-on is required for continued public hosting

Recommended policy decision for later:

- if add-on expires, existing public links should either:
  - stop resolving after a grace period, or
  - remain viewable but new link generation is blocked

The safer initial implementation is:

- block new link creation when entitlement is inactive
- allow operators/shop admins to revoke old links
- decide separately whether public access itself should be suspended on add-on expiry

## 7. UI Planning

### Internal Shop UI

Add management controls in a place that makes sense for invoice workflow:

- Job Detail
- Payments / Totals / Invoice area

Primary actions:

- `Create Public Invoice Link`
- `Copy Link`
- `Revoke Link`
- `Regenerate Link`

Visible metadata:

- status
- expiry
- last viewed at
- total views

Recommended UX shape:

- one compact "Public Link" panel in the billing/invoice section
- show current active link if one exists
- if none exists, show create CTA
- revoke and regenerate require confirmation

### Customer Profile

Not required for first pass.

It may later be useful to show all public links for a customer's jobs, but beta.12 should stay job-scoped.

### Admin/Operator Visibility

Optional but useful later:

- operator dashboard section for public-link usage
- identify highly viewed or stale links
- identify revoked links and suspicious traffic

## 8. Public Page Design

The public page should feel like a clean, trustworthy invoice surface rather than a stripped-down app screen.

Required content:

- branded shop header
- job number
- customer-safe instrument summary
- invoice totals
- balance due
- visible payment history summary if appropriate
- allowed work-order details

Required constraints:

- no edit controls
- no internal nav
- no login requirement
- no internal notes
- no admin actions

Recommended public page sections:

1. Shop header
2. Invoice/work-order summary
3. Services and parts
4. Totals and payments
5. Balance due
6. Payment instructions or note
7. Future payment action placeholder

## 9. Sanitized Public Payload

Public payload should likely be assembled by a dedicated server-side function rather than by sending the full job object.

Suggested payload fields:

- `shop`
  - `name`
  - `phone`
  - `email`
  - `logo_url` if allowed
- `invoice`
  - `job_number`
  - `status`
  - `date_received`
  - `customer_name` if policy allows
  - `instrument`
  - `services`
  - `parts`
  - `subtotal`
  - `tax_label`
  - `tax_amount`
  - `discount_amount`
  - `total_due`
  - `paid_total`
  - `balance_due`
  - `payment_note`

Never send:

- full `tech_details`
- hidden inspection structures
- internal work logs by default
- raw customer_messages
- private image storage paths

## 10. Implementation Shape for Beta.12

Recommended build order:

1. Add data model and RLS.
2. Add entitlement key and server-side enforcement.
3. Add authenticated management RPCs/functions for create/revoke/regenerate.
4. Add public resolve RPC/function that returns sanitized data only.
5. Add internal management UI on Job Detail / invoice area.
6. Add public route/page.
7. Add view tracking and basic rate limiting.
8. Validate with cross-shop and revoked/expired-link tests.

## 11. Open Design Decisions

These should be answered before implementation:

1. One active public link per job, or multiple allowed?
   - recommended initial answer: one active link per job

2. Show customer name publicly or not?
   - recommended initial answer: yes, but only display name, not phone/email/address

3. Should public link survive plan downgrade?
   - recommended initial answer: generation blocked when add-on inactive; existing-link behavior decided explicitly

4. Should public link cover invoice only, or invoice + work-order summary together?
   - recommended initial answer: include invoice summary plus customer-safe work-order summary

5. Should public links be delivered from main app domain or dedicated public subdomain?
   - recommended initial answer: main app domain first, dedicated public subdomain later if needed

## 12. Future Extensions

Planned later, not beta.12:

- Stripe payment link integration
- embedded payment collection
- customer portal
- SMS invoice links
- custom domain support
- branded embed widget for shop websites
- QR code on printed invoice
- downloadable PDF invoice
- optional public photo/document attachments

## 13. Validation Expectations For Implementation Phase

When this is actually built, validation must include:

- RLS/security review
- anonymous user cannot access invoice by job ID
- anonymous user cannot enumerate links
- revoked link fails cleanly
- expired link fails cleanly
- regenerated old token fails
- cross-shop leakage is impossible
- internal notes/cost fields do not appear
- entitlement enforcement is server-side
- rate limiting works
- view counts update safely

## 14. Recommendation

This is a strong premium feature for post-beta monetization because it connects FretTrack to a shop's public customer experience without forcing a full customer portal on day one.

The safest implementation path is:

- add-on entitlement
- tokenized public access
- sanitized server-built payload
- separate public route
- no reuse of private app job objects as-is

That keeps the normal repair workflow simple while opening a credible website-linked invoice path for higher-value paid shops.
