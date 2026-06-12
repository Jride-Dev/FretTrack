# Deployment Notes

Review this file before every production deploy and after every manual database/function deployment.

## Current Deployment Status

- Current branch checked during this review: `main`.
- `main` was pushed and deployed after Permission Hardening + Premium Trial Management Phase 1.
- App domain returned `200 OK` on 2026-06-11: https://app.frettrack-app.com/
- Landing domain returned `200 OK` on 2026-06-11: https://frettrack-app.com/
- Current app assets served by Cloudflare Pages:
  - `assets/index-BcktOB5k.js`
  - `assets/index-BCAqPMbL.css`

## Current Migration Note

`npm run check:migrations` currently reports no remote-only drift and these pending local migrations:

- `20260606093000`
- `20260606103000`
- `20260608120000`
- `20260609100000`
- `20260609113000`
- `20260611120000`
- `20260611133000`

These should be treated as deployment-history alignment items before future production migration work. Some may have already been manually applied or deployment-tested; verify remote migration history before future production migration work.

Do not use a blanket production migration push while unrelated local migrations are still pending.

## Recent Deployed Systems

- Inventory foundation
- Scheduling / Calendar Phase 1
- Premium entitlement foundation
- Advanced Reporting Phase 1
- Beta access operator notification fix
- Beta approval notification function
- Photo Editor Phase 1 frontend
- Photo Editor Phase 1 documentation and screenshot: `docs/screenshots/photo_editor.jpg`
- Permission hardening with centralized role checks and granular photo controls
- Premium Trial Management Phase 1 with operator-managed 7/14/30-day Pro trials
- Expired premium trials fall back to writable Free-tier core workflow while premium features lock
- Free vs Pro Tier Split Phase 1 is implemented locally but not deployed from this documentation pass
- Customer email/SMS Edge Function effective team-member access hardening is implemented locally but not deployed from this review pass
- `notify-beta-access-request` Supabase Edge Function
- `notify-beta-approval` Supabase Edge Function
- Cloudflare landing Worker beta application email path
- Cloudflare landing Worker beta application hardening deployed on 2026-06-12: Supabase request creation is authoritative, email/R2 archive failures return warnings after save, and `npm run check:landing-worker` covers the request lifecycle.

## Verification Reminders

Before future deploys, check:

```powershell
git status
git branch --show-current
git pull origin main
npm run check:migrations
npm run check:landing-worker
npm run build
git diff --check
curl.exe -I https://app.frettrack-app.com/
curl.exe -I https://frettrack-app.com/
```

## Manual Deployment Caveats

- Do not use a blanket production migration push when unrelated local migrations are still pending.
- Premium Trial Management Phase 1 adds `20260611120000_premium_trial_management_phase_1.sql`. It replaces entitlement snapshot behavior and adds operator-only trial RPCs; verify migration-history alignment before future production migration work.
- Free vs Pro Tier Split Phase 1 adds `20260611133000_free_pro_tier_split_phase_1.sql`. It seeds explicit `photo_editor`, `advanced_reporting`, and `team_members` entitlements and hardens team-member access/RPCs. This migration still needs an intentional production apply after review.
- The Free vs Pro review also updates `send-email` and `send-sms`; deploy those Edge Functions after the database migration so service-role message sends respect effective team-member access.
- Beta access approval and premium trial state are separate. Do not use premium trial expiry as a reason to remove beta approval.
- Premium trial expiry should return the shop to Free-tier entitlements while keeping core shop operations writable.
- Free owner access must remain active after downgrade. Existing non-owner staff memberships should be preserved but inactive while `team_members` is false, then restored when Pro entitlement returns.
- Stripe, billing webhooks, and payment collection are still not connected.
- If a migration is manually applied with `supabase db query --linked --file`, confirm the schema change and then align remote migration history intentionally.
- Confirm Supabase Edge Function secrets by name only; never print secret values.
- Confirm Cloudflare Worker secrets by name only; never print secret values.
- For public beta application issues, run `npm run check:landing-worker`, submit a live test through `https://frettrack-app.com/api/beta-application`, and confirm the saved row in `public.beta_access_requests`.
- If frontend asset hashes are used to confirm a deployment, compare the current app HTML against the most recent local build output.
