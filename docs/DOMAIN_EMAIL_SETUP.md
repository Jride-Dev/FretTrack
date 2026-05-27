# FretTrack Domain And Email Setup

Domain: `frettrack-app.com`

## Cloudflare Status

- Zone is active in Cloudflare.
- Nameservers:
  - `molly.ns.cloudflare.com`
  - `tosana.ns.cloudflare.com`
- Cloudflare Pages project:
  - Project: `frettrack`
  - Pages subdomain: `frettrack.pages.dev`
  - Custom app domain: `app.frettrack-app.com`
- Cloudflare Worker:
  - Worker: `frettrack-coming-soon`
  - Custom root domain: `frettrack-app.com`
  - Custom www domain: `www.frettrack-app.com`
  - Source: `cloudflare/frettrack-coming-soon`
  - Required variables/secrets:
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `RESEND_API_KEY`
    - `SHOP_EMAIL_FROM`
    - Optional `BETA_APPLICATION_NOTIFY_TO`
- Cloudflare R2:
  - Bucket: `frettrack-app-assets`
  - Worker binding: `FRETTRACK_APP_ASSETS`
  - Public asset paths are served through the Worker under `https://frettrack-app.com/assets/...`
  - Current objects:
    - `site/frettrack-banner.png`
    - `site/frettrack-emblem.png`
  - Beta applications are stored as private JSON objects under `beta-applications/YYYY-MM-DD/{uuid}.json`
- DNS:
  - `app.frettrack-app.com` CNAME to `frettrack.pages.dev`
  - Cloudflare Email Routing MX records enabled
  - SPF includes Cloudflare Email Routing and Amazon SES/Resend
  - Resend custom MAIL FROM records added at `send.frettrack-app.com`
  - Resend DKIM record added at `resend._domainkey.frettrack-app.com`
  - DMARC monitoring record exists
- Inbound email routing:
  - `support@frettrack-app.com` forwards to the verified Cloudflare destination `jaycurtis@techie.com`
  - `noreply@frettrack-app.com` forwards to the verified Cloudflare destination `jaycurtis@techie.com`

## What Cloudflare Does Not Provide

Cloudflare Email Routing handles inbound forwarding. It is not outbound SMTP for Supabase Auth invites.

For branded invite emails from:

```text
FretTrack <noreply@frettrack-app.com>
```

Supabase Auth needs custom SMTP configured with an outbound email provider such as Resend, Postmark, SendGrid, or Mailgun.

## Remaining SMTP Steps

Recommended provider: Resend.

1. Verify the domain in Resend.
2. In Supabase Dashboard, go to Authentication SMTP settings.
3. Enable custom SMTP using Resend SMTP credentials.
4. Set sender:

```text
FretTrack <noreply@frettrack-app.com>
```

5. In Supabase Authentication URL settings, set:

```text
Site URL: https://app.frettrack-app.com
Redirect URLs:
https://app.frettrack-app.com/**
http://localhost:5173/**
```

6. Customize the Supabase Invite user email template so it says FretTrack, not Supabase.
7. Send a test invite to an internal address before inviting outside testers.

## Website Deployment Notes

The production app is hosted on Cloudflare Pages at:

```text
https://app.frettrack-app.com
```

The public root domain is a separate Cloudflare Worker:

```text
https://frettrack-app.com
```

Deploy the app:

1. Connect Cloudflare Pages to `Jride-Dev/FretTrack`.
2. Production branch: `add-auth-shop-memberships` until the beta branch is merged.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Set required Pages environment variables from `.env`.
6. Deploy.
7. Confirm `https://app.frettrack-app.com` loads.
8. Update Supabase Auth Site URL and redirect URLs.

Deploy the root coming-soon page:

```powershell
npx wrangler deploy --config cloudflare/frettrack-coming-soon/wrangler.jsonc
```

The beta application endpoint calls Supabase RPC `public.submit_beta_access_request`, so the Worker must have `SUPABASE_URL` and `SUPABASE_ANON_KEY` configured before form submissions will create Operator Dashboard requests.

It also sends confirmation and notification email through Resend, so the Worker must have:

- `RESEND_API_KEY`
- `SHOP_EMAIL_FROM`
- Optional `BETA_APPLICATION_NOTIFY_TO` if you want the operator notification to go somewhere other than `support@frettrack-app.com`

Confirm:

```powershell
curl.exe -I https://frettrack-app.com/
curl.exe -I https://www.frettrack-app.com/
```

Update public site images:

```powershell
npx wrangler r2 object put frettrack-app-assets/site/frettrack-banner.png --remote --file public/frettrack-banner.png --content-type image/png --cache-control "public, max-age=300"
npx wrangler r2 object put frettrack-app-assets/site/frettrack-emblem.png --remote --file public/frettrack-emblem.png --content-type image/png --cache-control "public, max-age=300"
```

Confirm images:

```powershell
curl.exe -I https://frettrack-app.com/assets/frettrack-banner.png
curl.exe -I https://frettrack-app.com/assets/frettrack-emblem.png
```

Smoke test the beta application form endpoint:

```powershell
$payload = @{
  name = 'FretTrack Smoke Test'
  state = 'CA'
  shopName = 'Internal Test Shop'
  teamSize = '1'
  currentTracking = 'Smoke test submission from deployment verification.'
  email = 'support@frettrack-app.com'
} | ConvertTo-Json -Compress

$payload | curl.exe -sS --max-time 20 -X POST https://frettrack-app.com/api/beta-application -H "Content-Type: application/json" --data-binary "@-"
```
