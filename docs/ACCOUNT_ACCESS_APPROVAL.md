# Account Registration and Historical Approval Records

FretTrack now uses self-service registration. A new user creates an account, confirms the email address, creates one shop workspace, and immediately begins the standard non-converting 14-day Pro trial. No manual account approval is required.

## Flow

- A public access application creates or updates a pending access request without creating a shop.
- The applicant receives a confirmation email and the operator receives a notification when email delivery is configured.
- Pending or rejected users cannot bootstrap a shop or load protected shop data.
- An operator approves or rejects the request from the internal Operator Dashboard.
- Approval email delivery uses a durable claim, provider idempotency, and guarded finalization so retries do not send duplicate approval messages.
- An email-confirmed user can create the first shop. The bootstrap RPC atomically creates the shop profile, owner membership, and default non-converting 14-day Pro trial.
- One owner account cannot repeatedly create new trial workspaces.

## Compatibility identifiers

Database objects and deployed function slugs retain names such as `beta_access_requests`, `submit_beta_access_request`, `notify-beta-access-request`, and `notify-beta-approval` for historical compatibility and audit records. They are no longer part of normal registration.

## Security boundary

- A user can read only their own access request.
- Only platform operators can approve or reject access.
- The public submission RPC validates input and never accepts an approved state from the caller.
- Shop bootstrap requires authenticated, email-confirmed, approved access or operator status.
- Approval-delivery ledger RPCs are service-role only.

## Verification

- A new user must confirm the signup email before creating a shop.
- Pending users cannot load shop data or create a workspace.
- The operator can approve the request.
- Approval notification retries create at most one provider delivery.
- The approved user can bootstrap exactly one owner workspace.
- A normal user cannot approve their own request.
