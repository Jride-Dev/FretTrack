# FretTrack Testing

FretTrack uses three complementary test layers:

1. Focused Node and Deno regression checks cover module contracts and known regressions.
2. pgTAP tests run against local Supabase and prove database structure, RLS, and permission behavior.
3. Playwright tests exercise the application in Chromium against the local Supabase stack.

Browserbase is reserved for opt-in smoke tests against an accessible preview or production URL. Mandatory pull-request tests do not use paid Browserbase sessions and never expose the local Supabase stack to the internet.

## Local prerequisites

- Docker Desktop is running.
- The Supabase CLI is installed.
- Node dependencies are installed with `npm ci` or `npm install`.
- `.env.local` points to the local Supabase API. `npm run dev:test` refuses to start if it points to a hosted project.

## Database and RLS tests

Start Supabase and run the transactional pgTAP suite:

```powershell
supabase start
npm run test:db
```

Tests live under `supabase/tests/database`. Each pgTAP file begins a transaction and rolls it back, so its users, shops, and records do not persist after the test.

The initial shop-scope suite verifies:

- every public table has RLS enabled;
- owners can read and update their own shop's customers;
- owners cannot read, update, or insert into another shop;
- owners cannot enumerate another shop's memberships;
- viewers can read their assigned shop but cannot insert or update customers.

## Playwright tests

Prepare deterministic local-only fixtures, then run Chromium:

```powershell
npm run test:e2e:seed
npm run test:e2e
```

Use `npm run test:e2e:ui` for Playwright's interactive test runner. The fixture seed refuses non-local database URLs unless a developer deliberately passes the existing remote override; automated test commands never pass that override.

The seeded browser owner is `test1.owner@frettrack.local`. Its password is a local fixture value defined by the seed script, not a production credential. Playwright stores the authenticated browser state under ignored `playwright/.auth/` and never commits it.

The browser matrix also seeds `test2.owner@frettrack.local` as a UK shop using GBP, 20% VAT, metric measurements, and millimetres. Focused job tests verify that saved Work Notes persist and that Job Detail, billing totals, and the printable Job Sheet all use the authoritative shop localization settings.

Failure screenshots, traces, videos, and HTML reports are stored in ignored Playwright output directories.

## Browserbase secrets

Local Browserbase credentials belong in ignored `.env.browserbase.local`:

```dotenv
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
```

GitHub-hosted Browserbase jobs must use separate Actions secrets with those exact names. Never prefix either value with `VITE_`, place it in frontend code, or print it in test output.

## Continuous integration

The Quality Checks workflow runs local Supabase in its own job, applies repository migrations, runs pgTAP, creates isolated browser fixtures, installs Chromium, and runs Playwright. Playwright failure artifacts are retained for seven days. The existing regression-and-build job remains separate so a database/browser failure is clearly distinguishable from a source regression or production build failure.
