# Pro Loyalty Program

FretTrack’s initial Loyalty Program is a Pro/Enterprise stamp ledger, not a second payment system. A shop chooses how many stamps a qualifying work order earns, how many stamps are required for a reward, the reward name, and staff-facing terms.

## Earning stamps

Stamps are backed by work orders opened after the program starts. A linked customer earns them only when the work order is Completed or Picked Up, has a positive billed total, and is fully paid according to the saved parts, services, tax, discount, and payment data.

Each source work order has one reconciled award row. Repeated saves cannot duplicate it. Removing or refunding payment, reopening the work order, unlinking the customer, disabling the program, or losing the Pro entitlement makes the award inactive. Restoring the same work order restores the same award rather than issuing another one.

Once a work order earns a stamp, that award cannot move to a different customer or shop. Changing the work-order owner reverses it; restoring the original customer restores the same row. This prevents one paid job from funding redemptions in two customer accounts.

The start timestamp prevents enabling the feature from unexpectedly awarding years of historical work. Rebuilding the program reconciles eligible work opened after that boundary. Changing the stamps-per-job setting affects new awards; it does not rewrite the points snapshot on awards already earned.

## Redeeming rewards

Customer profiles show active stamps, lifetime redemption activity, progress, and available rewards. A writable staff member explicitly confirms each redemption. The database locks the customer while checking the balance and stores a shop-scoped idempotency key, reward-name snapshot, points spent, staff identity, note, timestamp, and optional source work order.

The Loyalty Program does not create store credit, take payment, or silently edit an invoice. After recording redemption, staff intentionally add the promised service or discount to the relevant work order using FretTrack’s existing billing controls. This keeps taxes, refunds, reporting, and customer balances in the established accounting path.

## Access control

`loyalty_program` is false for Free/Solo/Shop/Trial and true for Pro/Enterprise. Shop members can view their own shop’s program and customer activity. Only owners/admins can configure or rebuild it. Only writable shop roles can redeem a reward. Non-Pro shops cannot read configuration or earn awards even if a stale raw rule is enabled.

Award and redemption tables have RLS and explicit Data API grants. Authenticated clients cannot insert or edit either ledger directly; award reconciliation is trigger-owned and redemptions go through the guarded RPC.

## Deployment and validation

Migration `20260822041624_pro_loyalty_program.sql` creates the entitlement, configuration, reconciled work-order awards, redemption audit ledger, billing-state triggers, RLS policies, and RPCs. No Edge Function, provider account, Cron job, or new secret is required.

No remote migration or app deployment is performed merely by merging this source. Production changes always require explicit deployment approval.

The production rollout completed on 2026-08-22 and is incorporated into stable 0.3.0. Migration `20260822041624_pro_loyalty_program.sql` is recorded remotely. The migration does not enable a shop's loyalty rule, award historical work predating the configured start boundary, or create a reward redemption automatically.

```powershell
npm run check:loyalty-program
npm run test:db
npm run check:permissions
npm run check:role-permissions
npm run check:tiers
npm run check:migrations
npm run build
git diff --check
```
