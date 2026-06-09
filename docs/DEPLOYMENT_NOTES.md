# Deployment Notes

Review this file before every production deploy and after every manual database/function deployment.

## Current Deployment Status

- `main` is synced with `origin/main`.
- Working tree was clean after the latest deploy verification.
- App domain returned `200 OK`: https://app.frettrack-app.com/
- Landing domain returned `200 OK`: https://frettrack-app.com/

## Current Migration Note

`npm run check:migrations` currently reports these pending local migrations:

- `20260606093000`
- `20260606103000`
- `20260608120000`

These may already be manually applied or deployment-tested, but remote migration history alignment should be verified before future production migration work.

## Recent Deployed Systems

- Inventory foundation
- Scheduling / Calendar Phase 1
- Premium entitlement foundation
- Advanced Reporting Phase 1
- Beta access operator notification fix
- `notify-beta-access-request` Supabase Edge Function
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
