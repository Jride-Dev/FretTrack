# Supabase RPC Security Audit

Date: 2026-06-16

This note documents the SECURITY DEFINER RPC hardening pass for Supabase Security Advisor findings.

## Callable Role Classification

| RPC | Classification | Reason |
| --- | --- | --- |
| `submit_beta_access_request(text,text,text,text)` | Public intake, intentionally callable by `anon` for now | The Cloudflare landing Worker currently submits public beta applications with the anon key. Inputs are normalized/bounded and status is always server-assigned as `pending`. Future hardening should move this to Worker-only service credentials. |
| `add_inventory_part_to_job(uuid,uuid,integer)` | Authenticated app RPC | Requires `auth.uid()`, job write permission, shop lifecycle write permission, same-shop part/job ownership, active inventory part, and bounded positive quantity. |
| `update_inventory_job_part_quantity(uuid,integer)` | Authenticated app RPC | Requires `auth.uid()`, job/shop write permission, lifecycle write permission, same-shop inventory part, bounded positive quantity, and balanced stock movement deltas. |
| `create_transaction_event(jsonb)` | Authenticated app RPC | Requires `auth.uid()`, JSON object payload, explicit shop ID, shop write permission, shop-scoped customer/employee/reversal references, bounded amounts, and server-assigned `created_by`. |
| `get_current_user_shop_memberships()` | Authenticated user RPC | Returns only memberships for `auth.uid()` and preserves locked staff membership visibility without exposing unrelated shops. |
| `get_or_create_beta_access_request()` | Authenticated user RPC | Creates/returns the signed-in user's own beta access row. |
| `is_current_operator()` | Authenticated user RPC | Returns a boolean from the internal operator guard. |
| `get_beta_access_requests()` | Operator-only RPC callable by authenticated | PostgREST uses the authenticated DB role, and the function checks `private.is_operator()` before returning protected data. |
| `get_beta_operator_dashboard()` | Operator-only RPC callable by authenticated | PostgREST uses the authenticated DB role, and the function checks `private.is_operator()` before returning protected data. |
| `update_beta_access_request(uuid,text,text)` | Operator-only RPC callable by authenticated | The function checks `private.is_operator()` before mutating beta access state. |
| `update_beta_shop_subscription(text,text,integer,boolean)` | Operator-only RPC callable by authenticated | The function checks `private.is_operator()` before mutating shop lifecycle state. |
| `set_shop_premium_trial(text,integer,text)` | Operator-only RPC callable by authenticated | The function checks `private.is_operator()` and restricts trial tier/duration. |
| `extend_shop_premium_trial(text,integer)` | Operator-only RPC callable by authenticated | The function checks `private.is_operator()` and restricts extension duration. |
| `end_shop_premium_trial(text)` | Operator-only RPC callable by authenticated | The function checks `private.is_operator()` and marks trial lifecycle expired without deleting shop data. |

## Hardening Applied

- Locked flagged RPC search paths to explicit schemas.
- Revoked `PUBLIC`, `anon`, and `authenticated` execution before re-granting only intended roles.
- Kept `submit_beta_access_request` callable by `anon` as an accepted current risk because the deployed public landing Worker uses the anon Supabase path.
- Strengthened inventory quantity bounds and authenticated-session checks.
- Strengthened transaction-event payload validation and shop-scoped reference checks.
- Preserved operator-only SQL guards for operator dashboard, beta access, and trial-management RPCs.

## Accepted Risk

`submit_beta_access_request` remains directly callable by `anon` through PostgREST because removing that grant would break the current public beta application path unless the Cloudflare Worker is first migrated to a server-side Supabase credential. The function does not accept status/operator fields and returns only a minimal response.

