# Security Policy

## Supported Versions

FretTrack is currently in public trial development. Security fixes are handled against the current `0.2.x` line.

## Reporting a Vulnerability

Please do not open public issues for suspected security problems.

Report vulnerabilities privately to the repository owner with:

- A short description of the issue.
- Steps to reproduce, if available.
- Whether any credentials, customer data, or shop data may be exposed.

## Public Repo Safety Notes

- Do not commit `.env` files or real service credentials.
- Keep Supabase service role keys, Resend keys, Twilio tokens, database URLs, and JWT secrets out of browser-facing `VITE_*` variables.
- Rotate any credential immediately if it is ever committed, logged, posted in an issue, sent in chat, uploaded in a screenshot, exposed in browser code, or shared publicly.
- Rotate Supabase service role keys from the Supabase project dashboard if they are ever exposed. After rotation, update the Edge Function secrets and any local `.env` files that used the old value.
- Rotate the FretTrack function key if either `FRETTRACK_FUNCTION_KEY` or `VITE_FRETTRACK_FUNCTION_KEY` is exposed. The same new random value must be deployed to the Edge Function secret and the matching trial build configuration.
- Treat `VITE_SUPABASE_ANON_KEY` as public by design, but keep Row Level Security and Edge Function authorization in place before using real shop data.
