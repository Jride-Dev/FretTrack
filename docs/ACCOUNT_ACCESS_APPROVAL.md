# Self-Service Account Registration

FretTrack now uses self-service registration. A new user creates an account, confirms the email address, creates one shop workspace, and immediately begins the standard non-converting 14-day Pro trial. No manual account approval is required.

## Flow

- A new user creates an account with an email address and password.
- Supabase sends the account-confirmation email. The user must confirm that address before creating a workspace.
- An email-confirmed user can create the first shop. The bootstrap RPC atomically creates the shop profile, owner membership, and default non-converting 14-day Pro trial.
- One owner account cannot repeatedly create new trial workspaces.
- The trial does not require a card and does not automatically convert into a paid Stripe subscription.
- Owners manage Shop or Pro subscriptions through Billing after the workspace exists.

## Compatibility identifiers

Database objects and deployed function slugs retain names such as `beta_access_requests`, `submit_beta_access_request`, `notify-beta-access-request`, and `notify-beta-approval` for historical compatibility and audit records. They are no longer part of normal registration.

## Security boundary

- Shop bootstrap requires an authenticated, email-confirmed account.
- The database derives the caller from `auth.uid()` and never accepts a user or owner identity from the client.
- One transaction creates the shop profile, Pro trial subscription, and owner membership.
- A per-account transaction lock and existing-owner check prevent parallel or repeated trial creation.
- Trial tier, duration, status, and dates are server-owned.
- The bootstrap RPC is unavailable to anonymous callers and does not loosen shop Row Level Security.

## Verification

- A new user must confirm the signup email before creating a shop.
- An anonymous or unconfirmed user cannot create a workspace.
- A confirmed user can bootstrap exactly one owner workspace.
- The new workspace receives one 14-day Pro trial without Stripe customer or subscription identifiers.
- A parallel or repeated bootstrap attempt cannot create another trial workspace.
- The created owner can access only the new shop through the normal membership and RLS boundaries.
