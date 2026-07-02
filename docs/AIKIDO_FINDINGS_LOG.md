# Aikido Findings Log

This file tracks Aikido-reported issues reviewed during FretTrack security hardening.

The goal is to separate:
- real vulnerabilities
- valid hardening gaps
- noisy severity ratings
- false positives
- useful scanner rules for a future internal security scan tool

## Findings

### 2026-07-02 - Missing Content Security Policy header

**Scanner:** Aikido Surface Monitoring  
**Finding:** Content Security Policy (CSP) header not set  
**Reported severity:** Critical  
**Affected URLs:**
- https://frettrack-app.com
- https://app.frettrack-app.com

**Assessment:** Real hardening gap, not a false positive. The severity is likely inflated unless paired with exploitable XSS or unsafe script/content injection, but both public surfaces should send a CSP.

**Fix path:**
- Cloudflare Pages app headers: `public/_headers`
- Cloudflare landing Worker HTML/static-page responses: `cloudflare/frettrack-coming-soon/src/index.js`

**Fix summary:** Add a starter CSP that allows FretTrack's own assets, inline landing/app styles/scripts, Supabase REST/WebSocket connections, Supabase media/image URLs, blob workers/previews, and data fonts/images. Preserve `Referrer-Policy`, `X-Content-Type-Options`, and no-store HTML behavior. Add `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

**Validation commands:**
```powershell
npm run build
Select-String -Path dist/_headers -Pattern "Content-Security-Policy"
Select-String -Path public/_headers,cloudflare/frettrack-coming-soon/src/index.js -Pattern "Content-Security-Policy|Permissions-Policy|content-security-policy|permissions-policy"
curl.exe -I https://frettrack-app.com/
curl.exe -I https://app.frettrack-app.com/
```

**Post-deploy checks:** Confirm `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` headers are present on both domains. Confirm app still works with Supabase auth, storage images, blob previews, and build assets.

**Future scanner rule candidate:** Check public URLs for missing CSP/security headers and classify severity based on app context, not scanner panic theater.
