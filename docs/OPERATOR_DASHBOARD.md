# Operator Dashboard

The internal Operator Dashboard supports FretTrack account approval, shop lifecycle support, trials, usage review, and operational troubleshooting. It is not customer analytics and is visible only to users listed in `public.operator_users`.

## Capabilities

- Review pending, approved, and rejected account-access requests.
- Approve or reject access and retry an unresolved approval notification safely.
- Review shops, memberships, subscription lifecycle, effective plan, usage, and recent activity.
- Start, extend, or end operator-managed Shop and Pro trials.
- Apply documented grace, read-only, canceled, or legacy-access support states.
- Review current environment and permission context without exposing secrets.

## Product terminology

The UI uses **Account Access**, **Approved shops**, **Pending approvals**, and **Legacy access**. Internal RPC, column, and component names containing `beta` remain compatibility identifiers until a dedicated schema migration is justified.

## Security

- Operator authority is checked server-side.
- Operator actions use guarded RPCs rather than direct unrestricted table writes.
- Normal owners, admins, technicians, and viewers cannot open operator routes.
- Shop subscriptions and account approval remain distinct; approving an account does not create a paid subscription.
