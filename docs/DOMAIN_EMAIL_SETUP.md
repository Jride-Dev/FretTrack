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
  - Bundled static asset binding: `LANDING_ASSETS`
  - Bundled public asset paths include `/favicon.ico`, `/site.webmanifest`, and `/landing/...` product screenshots.
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
  - `jeff@frettrack-app.com` forwards to the verified Cloudflare destination `jaycurtis@techie.com`

## Inbound Sender Denylist

The dedicated Cloudflare Email Worker in `cloudflare/frettrack-inbound-email-filter` rejects known unwanted senders before forwarding mail to a verified Cloudflare destination. It currently rejects:

- `k.lerner@fisher-estates.com`
- Any sender at `fisher-estates.com`

The Worker checks both the SMTP envelope sender (`message.from`) and the visible `From` header, case-insensitively. Rejections are logged through Cloudflare Worker observability with the envelope sender, visible `From` value, recipient, reason, and UTC timestamp. The SMTP rejection text remains generic so it does not disclose policy details to the sender.

This is an email-routing control, not a website WAF rule. Do not block Titan Email, Flockmail, Amazon AWS, or a broad provider IP range. The reported `44.199.128.152` address is shared Titan outbound infrastructure and is intentionally not blocked here. No email-source-IP policy exists in the current Cloudflare configuration.

### Deploy And Attach The Email Worker

Do this only after the Worker code has been reviewed and deployed. Do not remove the existing direct-forward rules until the corresponding Worker secrets have been configured.

```powershell
npx wrangler deploy --config cloudflare/frettrack-inbound-email-filter/wrangler.jsonc
npx wrangler secret put SUPPORT_FORWARD_TO --config cloudflare/frettrack-inbound-email-filter/wrangler.jsonc
npx wrangler secret put NOREPLY_FORWARD_TO --config cloudflare/frettrack-inbound-email-filter/wrangler.jsonc
npx wrangler secret put JEFF_FORWARD_TO --config cloudflare/frettrack-inbound-email-filter/wrangler.jsonc
```

Set each secret to the verified destination or comma-separated verified destinations that should receive that mailbox. At the time this was documented, the only registered verified destination for these routes was `jaycurtis@techie.com`; verify any mail.com alias in Cloudflare Email Routing before using it.

Then replace only these three Email Routing rule actions with the Worker action `frettrack-inbound-email-filter` while leaving all other routing rules and the disabled catch-all untouched:

- `support@frettrack-app.com`
- `noreply@frettrack-app.com`
- `jeff@frettrack-app.com`

Verify the rule configuration without changing it:

```powershell
npx wrangler email routing rules list frettrack-app.com
npx wrangler email routing addresses list
npx wrangler tail frettrack-inbound-email-filter --format pretty
```

Run the repository check before deploy:

```powershell
npm run check:inbound-email-denylist
```

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

The root Worker has two asset paths:

- Bundled static assets in `cloudflare/frettrack-coming-soon/public`, served by the `LANDING_ASSETS` binding. This is
  where the favicon package and launch-page screenshots live.
- Existing R2 assets under `https://frettrack-app.com/assets/...`, served by the `FRETTRACK_APP_ASSETS` binding.

The beta application endpoint calls Supabase RPC `public.submit_beta_access_request`, so the Worker must have `SUPABASE_URL` and `SUPABASE_ANON_KEY` configured before form submissions will create Operator Dashboard requests.

It also sends confirmation and notification email through Resend, so the Worker must have:

- `RESEND_API_KEY`
- `SHOP_EMAIL_FROM`
- Optional `BETA_APPLICATION_NOTIFY_TO` if you want the operator notification to go somewhere other than `support@frettrack-app.com`

Confirm:

```powershell
curl.exe -I https://frettrack-app.com/
curl.exe -I https://www.frettrack-app.com/
curl.exe -I https://frettrack-app.com/favicon.ico
curl.exe -I https://frettrack-app.com/landing/overview.jpg
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
