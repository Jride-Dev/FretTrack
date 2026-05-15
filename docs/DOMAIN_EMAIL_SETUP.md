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

The Cloudflare Pages project and custom domain exist, but the app still needs a deployment.

Recommended deployment:

1. Connect Cloudflare Pages to `Jride-Dev/FretTrack`.
2. Production branch: `add-auth-shop-memberships` until the beta branch is merged.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Set required Pages environment variables from `.env`.
6. Deploy.
7. Confirm `https://app.frettrack-app.com` loads.
8. Update Supabase Auth Site URL and redirect URLs.
