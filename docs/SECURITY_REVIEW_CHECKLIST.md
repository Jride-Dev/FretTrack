# Security Review Checklist

Use this checklist for stable 0.3.1 release verification and subsequent security hardening. Database or function identifiers containing `beta` are retained compatibility names, not customer-facing release status.

## Isolation

- verify shop isolation across all primary tables
- verify customer isolation by shop
- verify job isolation by shop
- confirm no cross-shop reads through helper queries or Edge Functions

## Messaging and Document Actions

- verify invoice email authorization
- verify work-order email authorization
- verify only authorized shop members can trigger outbound document sends

## Offline Continuity

- verify offline draft sync only creates jobs inside the current authorized shop
- verify offline draft sync cannot be replayed across shops
- verify duplicate prevention remains active during manual sync

## Edge Functions

- review Edge Function auth and JWT assumptions
- confirm function logic does not rely on frontend-only trust
- confirm shop membership and job access are rechecked server-side where needed

## Secrets

- verify no service role key exists in frontend code
- verify provider secrets remain server-side only
- treat browser-facing values as public unless explicitly server-bound

## Public Link Future Work

- verify no cross-shop leakage in future public invoice/work-order links
- require secure tokenized access rather than guessable ids
- require revoke/expiry behavior before paid launch

## Paid Launch Gate

- perform a focused RLS review before paid launch
- re-check billing, entitlement, messaging, and public-link surfaces before self-serve rollout
- require signature-verified Stripe webhooks as the only paid-plan mutation boundary; opening or abandoning Checkout must not change entitlements
- verify failed webhook deliveries remain retryable and opaque Stripe Price IDs are matched only against configured secrets

## 2026-08-11 Launch Audit Evidence

- `npm run check:permissions`, `npm run check:role-permissions`, and `npm run check:stripe-edge-functions` passed.
- `npm run check:production-build-config` passed, and a focused source/build scan found no service-role JWT, Stripe secret, webhook secret, private key, or Resend secret in `src/` or `dist/`.
- `get_public_system_status` is intentionally anonymous and returns only the public operational-status fields.
- `submit_beta_access_request` is intentionally anonymous for the public access form; its inputs are bounded and normalized, it cannot approve access, and this accepted compatibility boundary remains documented in `docs/SUPABASE_RPC_SECURITY_AUDIT.md`.
- The linked Supabase organization was verified on the Free plan on `2026-08-11`, where leaked-password protection is unavailable. This limitation is an explicitly accepted pre-launch risk unless the project is upgraded; email confirmation remains required, anonymous sign-in is disabled, and phone sign-in is disabled. Recheck the dashboard's minimum-length/password-strength settings and sign-in/password-reset behavior immediately before paid launch.
- Migration `20260812025459_harden_set_updated_at_search_path.sql` pins the shared `set_updated_at` trigger helper to an empty search path, schema-qualifies `pg_catalog.now()`, and removes direct public/client execution. The local trigger test passed and Supabase Security Advisor returned no warnings after the migration.
- The linked advisor's client-callable `SECURITY DEFINER` findings were triaged. `get_public_system_status` and `submit_beta_access_request` are intentionally anonymous, fixed-purpose projections/intake paths with bounded output/input. Authenticated bootstrap, inventory/PO receiving, usage, operator, entitlement, and transaction RPCs retain their required client grants but pin search paths and authorize the caller inside the function. `npm run check:permissions` now covers the newer bootstrap, system-status, and receiving boundaries as well as the earlier RPC audit.
- The advisor's no-policy notices for `system_status`, `shop_photo_storage_objects`, and `shop_usage_reservations` are informational: direct table grants are revoked and access is intentionally mediated by fixed RPC/service-role paths.
