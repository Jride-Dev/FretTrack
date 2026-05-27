# Beta Access Approval Gate

FretTrack beta access is intentionally controlled. A Supabase Auth user may sign in and confirm email, but that alone does not grant shop/workspace access.

## Flow

- New authenticated users get a `public.beta_access_requests` row with `pending` status.
- Pending or rejected users see the Pending Approval screen before any shop bootstrap or job loading runs.
- Operators bypass the gate and can approve or reject users from the Beta Operator Dashboard.
- Approved users can continue into normal onboarding and create or access a shop workspace.
- Existing shop members and active operators are backfilled as approved by the migration.

## Server-Side Controls

- `shop_members_insert_bootstrap_owner` now requires approved beta access or operator access before creating the first owner membership.
- Normal authenticated users can read their own beta access request and create their own pending request.
- Only operators can update request status.
- Approval uses `public.update_beta_access_request`, which verifies operator status server-side.

## Smoke Checklist

- New Supabase Auth user signs in and gets a pending request.
- Pending user sees “Pending Approval” and cannot create a shop.
- Pending user cannot load jobs, reports, billing, uploads, or operator routes.
- Operator sees the pending request in the Beta Operator Dashboard.
- Operator approves the request.
- Approved user can retry access and continue onboarding.
- Existing beta shop users still load normally after migration.
- A normal authenticated user cannot update their own status to approved.
- `npm run build` passes.
- `npm run check:migrations` passes.
