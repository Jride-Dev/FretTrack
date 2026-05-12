# Shop Provisioning and Installer Packaging

This plan keeps customer shops out of Supabase and Resend administration. FretTrack owns the backend accounts, provisions each shop, then gives the shop a package that opens directly into its own configured app.

## Operating Model

- Each shop gets a separate Supabase project/database under the FretTrack operator account.
- Resend stays under the FretTrack operator account.
- Shop-specific email sender/domain setup is handled during provisioning.
- The shop receives a configured installer or ZIP package. The shop should not need to create accounts, paste API keys, or run SQL.

## Per-Shop Provisioning Checklist

1. Create a new Supabase project for the shop.
2. Run `supabase-schema.sql` against the shop project.
3. Confirm required schema migrations, including `job_images.public_url` and `work_logs.text`.
4. Create or verify the `job-images` storage bucket.
5. Deploy required Supabase Edge Functions.
6. Set Edge Function secrets:

```text
FRETTRACK_FUNCTION_KEY=<shop-specific random value>
RESEND_API_KEY=<operator Resend API key or scoped key>
SHOP_EMAIL_FROM=<verified sender for this shop>
```

7. Configure Resend sender/domain details for the shop.
8. Generate the shop app config:

```text
VITE_SUPABASE_URL=<shop Supabase project URL>
VITE_SUPABASE_ANON_KEY=<shop Supabase anon key>
VITE_FRETTRACK_FUNCTION_KEY=<same shop function key>
VITE_SMS_ENABLED=false
```

9. Build the shop package.
10. Smoke test job creation, image upload, work log save, email send, print views, and app restart.

## Packaging Targets

### Phase 1: Shop ZIP Package

- Build a customer-specific folder such as `FretTrack-JRsCustomShop`.
- Include the app files, launch scripts, desktop shortcut helper, and shop config.
- Package it as `FretTrack-JRsCustomShop.zip`.
- Keep this as the fastest trial distribution method because it is easy to rebuild and inspect.

### Phase 2: Signed EXE Installer

- Create a Windows `.exe` installer after the ZIP flow is stable.
- Installer should install files, create shortcuts, validate runtime requirements, write/import shop config, and optionally launch the app.
- Prefer a signed installer before broader distribution so Windows SmartScreen warnings are reduced.

### Phase 3: MSI Package

- Add `.msi` packaging only if managed deployment becomes important.
- Use this for IT-managed installs, repair/uninstall behavior, and more formal business software distribution.

## Future Automation

- Add a `provision-shop` script that generates function keys, validates schema, checks storage bucket setup, writes shop config, and creates a release folder.
- Add a release checklist command that tests the configured package before it is sent to the shop.
- Add shop branding values to the config once branding becomes customer-specific.
