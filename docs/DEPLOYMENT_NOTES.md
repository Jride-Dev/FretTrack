# Deployment Notes

Review this file before every production deploy and after every manual database/function deployment.

## Current Deployment Status

- Current branch checked during this review: `main`.
- `main` was synced with `origin/main` at the latest deploy verification.
- The working tree was clean after the latest deploy verification. This file may be edited afterward for deployment-note maintenance.
- App domain returned `200 OK`: https://app.frettrack-app.com/
- Landing domain returned `200 OK`: https://frettrack-app.com/
- Current app assets served by Cloudflare Pages:
  - `index-Dmb4BCoV.js`
  - `index-8tAQrezA.css`

## Current Migration Note

`npm run check:migrations` currently reports no remote-only drift and these pending local migrations:

- `20260606093000`
- `20260606103000`
- `20260608120000`
- `20260609100000`
- `20260609113000`

These should be treated as deployment-history alignment items before future production migration work. Verify whether they are already manually applied in production or still need to be applied and recorded.

Do not use a blanket production migration push while unrelated local migrations are still pending.

## Recent Deployed Systems

- Inventory foundation
- Scheduling / Calendar Phase 1
- Premium entitlement foundation
- Advanced Reporting Phase 1
- Beta access operator notification fix
- Beta approval notification function
- Photo Editor Phase 1 frontend
- `notify-beta-access-request` Supabase Edge Function
- `notify-beta-approval` Supabase Edge Function
- Cloudflare landing Worker beta application email path

## Verification Reminders

Before future deploys, check:

```powershell
git status
git branch --show-current
git pull origin main
npm run check:migrations
npm run build
git diff --check
curl.exe -I https://app.frettrack-app.com/
curl.exe -I https://frettrack-app.com/
```

## Manual Deployment Caveats

- Do not use a blanket production migration push when unrelated local migrations are still pending.
- If a migration is manually applied with `supabase db query --linked --file`, confirm the schema change and then align remote migration history intentionally.
- Confirm Supabase Edge Function secrets by name only; never print secret values.
- Confirm Cloudflare Worker secrets by name only; never print secret values.
- If frontend asset hashes are used to confirm a deployment, compare the current app HTML against the most recent local build output.
