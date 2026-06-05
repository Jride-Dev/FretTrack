# Security Review Checklist

Use this checklist during the next beta-to-paid hardening pass.

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
