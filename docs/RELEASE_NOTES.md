# Release Notes

## v0.2.6-beta.10

This beta release promotes the new customer and subcontractor CRM workflow to a full beta milestone while documenting remaining print-system instability.

### Added

- Customer/Subcontractor management module.
- Customer profiles.
- Customer balances and payment history.
- CRM-style customer workflow.
- Customer creation modal.
- Mobile/tablet responsive improvements.
- Beta access workflow improvements.
- Email notification workflow.

### Known Issues

- Customer Damage Report print layout still requires redesign.
- Damage-map print rendering is inconsistent across print preview/browser flows.
- Visual damage-map print markers are temporarily disabled in production print output.
- Dedicated print renderer planned.

### Roadmap Note

- Replace current damage-map print approach with dedicated print-only renderer.
- Separate screen interaction rendering from printable report rendering.
- Rebuild visual print marker rendering behind screenshot checkpoints before re-enabling.

## v0.2.6-beta.9

FretTrack beta is getting sturdier for real shop use. This release tightens access, improves operator control, and makes the app friendlier on mobile and in print.

### Highlights

- Beta access approval gate so new sign-ins do not automatically enter a shop workspace.
- Operator approval workflow in the internal dashboard.
- Landing page beta application flow that creates real beta access requests.
- Email notifications for beta applications.
- Mobile and tablet responsive improvements across core screens.
- Print output improvements for job sheets and customer reports.
- Security and access hardening around beta onboarding and workspace bootstrap.

### Notes for beta testers

- Approved beta users should continue to sign in and work normally.
- Pending users will see an approval screen until an operator approves access.
- Print sheets should now be darker and easier to read.
- The app remains focused on repair workflow, not billing automation.

### GitHub summary

- Access control: beta approval requests and operator approvals.
- UX: better landing page application, mobile/tablet layout, and print readability.
- Stability: security/access hardening with no Stripe or billing automation added yet.
