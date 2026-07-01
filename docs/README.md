# FretTrack Docs

This folder is the home for product and technical documentation that does not belong in the root README.

FretTrack's old live baseline is `v0.2.6-beta.14`. Current branch planning uses product milestone versions:

- `v0.2.61 beta`: Customers complete
- `v0.2.62 beta`: Inventory complete
- `v0.2.63 beta`: Scheduling complete
- `v0.3.0 beta`: Operational Shop Release

Start here for the current product path:

- [Release notes](RELEASE_NOTES.md)
- [Roadmap](../ROADMAP.md)
- [Deployment notes](DEPLOYMENT_NOTES.md)
- [Reports](REPORTS.md)
- [Inventory purchasing notes](INVENTORY_PURCHASING.md)
- [Shipping foundation](SHIPPING.md)
- [Photo editor](PHOTO_EDITOR.md)
- [Architecture review beta 14](ARCHITECTURE_REVIEW_BETA14.md)
- [Print renderer rebuild plan](PRINT_RENDERER_REBUILD_PLAN.md)
- [Security review checklist](SECURITY_REVIEW_CHECKLIST.md)
- [Supabase RPC security audit](SUPABASE_RPC_SECURITY_AUDIT.md)
- [Offline continuity plan](OFFLINE_CONTINUITY_PLAN.md)
- [Offline mode audit](OFFLINE_MODE_AUDIT.md)
- [Public invoice links plan](PUBLIC_INVOICE_LINKS_PLAN.md)
- [Paid tier readiness audit](PAID_TIER_READINESS_AUDIT.md)
- [Subscription foundation](SUBSCRIPTION_FOUNDATION.md)
- [Beta operator dashboard](BETA_OPERATOR_DASHBOARD.md)
- [Trial readiness checklist](TRIAL_READINESS.md)

Core shipped beta areas now include:

- customer and subcontractor management
- public launch landing page refresh with bundled favicon and product screenshot assets
- public Terms of Service, Privacy Policy, and Support / FAQ pages on the landing site
- work-order and invoice email flow
- mobile and PWA readiness
- legacy WebKit compatibility for older iPad browser versions, with readable fallback messaging instead of black screens
- offline new-job draft queue with 0.2.8 scope audit
- editable job-level parts and services
- inventory purchasing foundation with parts, vendors, purchase orders, receiving, purchase history, barcode labels, inventory Location/Category presets, UPC-facing labels, Special Order Part behavior, small part images, inbound PO shipping, landed-cost allocation, and transactional receiving RPCs
- outbound job shipping foundation with `job_shipments`, address snapshots, carrier/tracking fields, RLS, and a small service module; UI, carrier APIs, labels/rates, and shipment notifications are still future work
- Scheduling / Calendar Phase 1
- unsaved-changes protection foundation
- premium entitlement foundation
- permission hardening with centralized role checks
- operator-managed Shop and Pro trial controls
- Shop Tier Foundation Phase 1
- Paid Access Lifecycle Phase 1
- Advanced Reporting Phase 1
- Pro Reports export, print, row-cap, and large-dataset safety behavior
- first-shop bootstrap reliability: approved/confirmed users create shop profile, owner membership, and default trial subscription together before the app loads real shop access
- beta approval applicant notifications
- Photo Editor Phase 1

Current permission and premium-trial behavior:

- Beta access approval and paid trial access are separate systems.
- New shop bootstrap requires confirmed email plus approved beta access or operator access; it creates the shop profile, owner membership, and default trial subscription atomically.
- Operators can start, extend, and end 7/14/30-day Shop or Pro trials.
- Expired trials preserve data and memberships, allow safe viewing, block writes, and lock premium entitlements.
- Internal `free`, `solo`, and `enterprise` values remain compatibility/fallback values during migration and should not be marketed as public plans.
- Shop currently covers the paid core workflow.
- Pro currently unlocks Photo Editor, Team Members, and Advanced Reporting.
- Photo permissions are split across upload, edit, overwrite, delete, and customer-report selection.
- Shop owners/admins can view subscription status but cannot manage premium trials unless they are also platform operators.

Additional documentation areas:

- API notes
- Schema docs
- Deployment guides
- Screenshots
- Branding assets
- Onboarding docs

Current docs:

- [Deployment notes](DEPLOYMENT_NOTES.md)
- [Beta operations](BETA_OPERATIONS.md)
- [Beta tester checklist](BETA_TESTER_CHECKLIST.md)
- [Customer import](CUSTOMER_IMPORT.md)
- Public Terms of Service: `https://frettrack-app.com/terms`
- Public Privacy Policy: `https://frettrack-app.com/privacy`
- Public Support / FAQ: `https://frettrack-app.com/support`
- [Beta access approval](BETA_ACCESS_APPROVAL.md)
- [Beta operator dashboard](BETA_OPERATOR_DASHBOARD.md)
- [Beta messaging](BETA_MESSAGING.md)
- [Domain and email setup](DOMAIN_EMAIL_SETUP.md)
- [Customer module plan](CUSTOMER_MODULE_PLAN.md)
- [Image optimization](IMAGE_OPTIMIZATION.md)
- [Inventory purchasing notes](INVENTORY_PURCHASING.md)
- [Shipping foundation](SHIPPING.md)
- [Reports](REPORTS.md)
- [Photo editor](PHOTO_EDITOR.md)
- [Mobile/tablet readiness audit](MOBILE_TABLET_READINESS_AUDIT.md)
- [Release notes](RELEASE_NOTES.md)
- [Shop provisioning and installer packaging](shop-provisioning-and-installer.md)
- [Trial readiness checklist](TRIAL_READINESS.md)
- [Supabase migration workflow](supabase-migrations.md)
- [Pricing and tiers](PRICING_AND_TIERS.md)
- [Offline continuity plan](OFFLINE_CONTINUITY_PLAN.md)
- [Offline mode audit](OFFLINE_MODE_AUDIT.md)
- [Public invoice links plan](PUBLIC_INVOICE_LINKS_PLAN.md)

The root README should stay focused on what the app is and how to open it. Deeper product, setup, and operational notes can live here as FretTrack grows from a React project into a product repository.
