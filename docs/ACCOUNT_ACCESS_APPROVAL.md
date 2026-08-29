# Account Access Approval

FretTrack uses controlled account approval before a new authenticated user can create or enter a shop workspace. Approval and the 14-day Pro trial are separate systems: approval controls account entry, while the trial or paid subscription controls shop features and write access.

## Flow

- A public access application creates or updates a pending access request without creating a shop.
- The applicant receives a confirmation email and the operator receives a notification when email delivery is configured.
- Pending or rejected users cannot bootstrap a shop or load protected shop data.
- An operator approves or rejects the request from the internal Operator Dashboard.
- Approval email delivery uses a durable claim, provider idempotency, and guarded finalization so retries do not send duplicate approval messages.
- An approved, email-confirmed user can create the first shop. The bootstrap RPC atomically creates the shop profile, owner membership, and default non-converting 14-day Pro trial.

## Compatibility identifiers

Database objects and deployed function slugs retain names such as `beta_access_requests`, `submit_beta_access_request`, `notify-beta-access-request`, and `notify-beta-approval`. These are stable internal compatibility identifiers, not customer-facing product terminology. Renaming them would require a separate schema and deployment migration with no user benefit.

## Security boundary

- A user can read only their own access request.
- Only platform operators can approve or reject access.
- The public submission RPC validates input and never accepts an approved state from the caller.
- Shop bootstrap requires authenticated, email-confirmed, approved access or operator status.
- Approval-delivery ledger RPCs are service-role only.

## Verification

- A new user remains pending before approval.
- Pending users cannot load shop data or create a workspace.
- The operator can approve the request.
- Approval notification retries create at most one provider delivery.
- The approved user can bootstrap exactly one owner workspace.
- A normal user cannot approve their own request.
