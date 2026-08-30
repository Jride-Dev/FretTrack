# FretTrack v0.3.1 Release Validation Checklist

Use this checklist for the stable Operational Shop Release. It supplements automated CI and does not authorize a production migration or deployment by itself.

## Repository and configuration

1. Confirm the release branch starts from current `main` and contains no unrelated files.
2. Confirm package metadata, in-app version, changelog, release notes, roadmap, public docs, and release checks all identify stable `0.3.1`.
3. Confirm no customer-facing page advertises a pre-release testing program.
4. Run `git diff --check` and `npm audit --audit-level=moderate`.
5. Run `npm run check:migrations` and review any local-only migration before remote work.
6. Run `npm run check:production-build-config` against the final production bundle.

## Automated validation

1. Run all focused `check:*` scripts used by the GitHub quality workflow.
2. Run `npm run test:db` against clean local Supabase.
3. Seed fictional local shops and run all Playwright projects with `npm run test:e2e`.
4. Run the production build and verify no local Supabase URL, test-shop default, or demo key is compiled into `dist`.
5. Confirm GitHub regression/build, database/browser, and security checks are green.

## Product smoke

1. Account approval and first-shop bootstrap.
2. Trial, Shop, and Pro plan labels and write boundaries.
3. Guitar, Amplifier, and Keyboard benches plus the shared Parts &amp; Payments workspace.
4. Customer creation, work-order creation, stale-save protection, work logs, parts, services, and payments.
5. Inventory, vendors, purchase orders, receiving, specialist purchasing, and billing transfer.
6. Scheduling, immediate email, Scheduled Email, cancellation, service reminders, loyalty, and Message History.
7. Customer Service and Condition Report plus invoice-style Job Sheet printing.
8. Accounting-safe work-order exclusion and restoration.
9. Owner, admin, technician, viewer, expired-access, and operator permissions.

## Production release

1. Obtain approval on the release PR after ITO and GitHub checks pass.
2. Merge to `main`.
3. Deploy the app through `npm run deploy:app:production`.
4. Deploy the public Cloudflare Worker only if its source or bundled assets changed.
5. Verify the app, landing page, docs, release notes, Terms, Privacy, Support, and legacy documentation aliases return successfully.
6. Confirm live asset hashes match the guarded production build.
7. Tag `v0.3.1` and publish the GitHub release.
8. Record deployment identifiers and verification evidence in [Deployment Notes](DEPLOYMENT_NOTES.md).
