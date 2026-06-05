# Architecture Review Beta 14

## Current Position

FretTrack is no longer just a prototype-level React app. By beta 14 it has real product surface area across intake, customers, payments, messaging, print, beta operations, mobile/PWA support, and offline continuity.

That is good progress, but it also means some early-file structures are now carrying more responsibility than they should long-term.

## Current Stack

- frontend: React + Vite
- primary data/auth/storage: Supabase
- frontend hosting: Cloudflare Pages
- landing page / beta application worker: Cloudflare Worker
- transactional email: Resend

## App Structure Note

`src/app/App.jsx` is becoming too large and should eventually be split into clearer boundaries such as:

- app shell
- session/auth/bootstrap providers
- workspace selection and membership handling
- shop workspace shell
- route or mode-level surfaces
- shared notices and banners

This is not an emergency rewrite target, but it is a real architectural pressure point.

## Source of Truth

Supabase remains the source of truth for:

- auth
- shop membership
- shop-scoped data
- storage
- Edge Function-backed messaging flows

Browser-local draft storage should remain a continuity layer only, not a competing authority.

## Hosting Boundaries

- Cloudflare Pages hosts the main FretTrack frontend at the app domain.
- Cloudflare Worker handles the landing page and beta application workflow.
- These roles should stay distinct so public marketing/application traffic does not blur into authenticated app behavior.

## Email Boundary

Resend handles email delivery through server-side flows. The frontend should keep using authenticated Supabase Edge Function paths rather than direct provider access.

## Railway Note

Railway should remain a future backend or API option only if a real operational need appears later.

It should not be introduced as:

- a frontend host replacement
- a database replacement for Supabase
- a random second operational backbone during beta

Right now, adding that kind of infrastructure split would create more risk than value.

## Offline Continuity Position

Offline drafts should stay conservative.

Beta 14 made the correct first move:

- new work-order drafts only
- IndexedDB
- manual sync
- no full offline database
- no aggressive background reconciliation

Future offline work should keep this same bias toward safety and clarity.
