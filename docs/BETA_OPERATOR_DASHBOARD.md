# Beta Operator Dashboard

FretTrack includes a lightweight internal dashboard for beta operations. It is not customer-facing analytics.

## Access Model

- Operators are listed in `public.operator_users`.
- Dashboard reads and access mutations go through server-side RPCs.
- Normal shop users can have the route hidden in the UI, but database functions still reject access unless `private.is_operator()` passes.
- No service-role keys are used in the frontend.
- Shop owners are not platform operators unless they are also listed in `public.operator_users`.
- Beta access approval and premium trial access are separate systems.

To add an operator, insert the signed-in user's Auth user ID into `public.operator_users` from a trusted database/admin context.

## Included Views

- Summary cards for beta shops, active users, trialing shops, beta bypass shops, grace/read-only shops, storage, jobs, and recent activity.
- Shops table with plan, subscription status, effective tier, access state, trial date, days remaining, usage, admins, and last activity.
- Member view with email, role, shop, last sign-in, and status.
- Usage view with storage bytes, image count, job count, monthly email/SMS counts, and storage safety hints.
- Activity feed sourced from job events, payment events, customer messages, and onboarding completion.
- Operator-only current access panel in the app shell showing email, user ID, active shop, role, beta access status, operator status, tier/status/trial data, enabled premium features, and write access.

## Minimal Actions

Operators can:

- Toggle a shop into or out of `beta_bypass`.
- Start a 7-day, 14-day, or 30-day Pro premium trial.
- Extend a premium trial by 7, 14, or 30 days.
- End a premium trial and return the shop to Free-tier entitlements while keeping core shop operations writable.
- Set subscription status to `trialing`, `active`, `grace`, `read_only`, `canceled`, or `beta_bypass`.

Beta-bypass and status actions call `public.update_beta_shop_subscription`. Premium trial actions call `public.set_shop_premium_trial`, `public.extend_shop_premium_trial`, and `public.end_shop_premium_trial`. They do not expose direct table writes from the browser.

## Smoke Checklist

- Normal shop user does not see the Operator navigation item.
- Normal shop user calling the dashboard RPC is rejected.
- Operator user sees the Operator navigation item.
- Operator-only user without a shop membership lands on the operator dashboard instead of Create Shop.
- Shops table loads shop profile, plan, status, usage, admin emails, and last activity.
- `Beta bypass` action changes the shop subscription status.
- `Start 7-day Pro trial`, `Start 14-day Pro trial`, and `Start 30-day Pro trial` set premium trial end from now and refresh the dashboard.
- `Extend +7`, `Extend +14`, and `Extend +30` extend from the greater of existing trial end or now.
- `End premium trial` downgrades effective premium tier to Free and keeps normal shop writes available.
- Status dropdown can mark a shop `active` or `read_only`.
- Usage view shows storage, image count, job count, and message counts.
- Activity feed shows recent job, payment, message, and onboarding events when present.
- `npm run build` passes.
- `npm run check:migrations` reports no remote-only drift.

## Known Limits

- Charts are intentionally omitted.
- Operator notes are planned but not implemented.
- Failed/oversized upload visibility depends on upload failure events being logged.
- Storage usage uses stored image metadata and latest usage snapshots, not a server image pipeline.
- Stripe, billing webhooks, and customer self-service subscription controls are not implemented.
