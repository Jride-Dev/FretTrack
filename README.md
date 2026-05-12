# FretTrack

Current version: `0.2.5`

## Release Positioning

- First public trial-ready release.
- Email notifications active.
- SMS planned/optional.
- Dark theme default.
- Work order system stable enough for real shop testing.

## Project Notes

- [Changelog](CHANGELOG.md) tracks release-by-release changes and historical fixes.
- [Roadmap](ROADMAP.md) tracks where the app is going next.
- [Known Issues](KNOWN_ISSUES.md) tracks trial limitations, setup traps, and bug/fix notes.
- [Docs](docs/README.md) is the home for deeper API, schema, deployment, branding, screenshot, and onboarding notes.

## Open the app

Use the desktop shortcut:

```text
FretTrack.lnk
```

If the Desktop shortcut ever says it cannot find the file specified, double-click this file from the app folder to recreate it:

```text
Create Desktop Shortcut.cmd
```

Or start the development server from this folder:

```powershell
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

The `:5432` address in `.env` is the Supabase Postgres database port. It is not the browser URL for this app.

If `npm run dev` says port `5173` is already in use, close the old dev server first and run it again. The app is configured with `strictPort: true` so Vite will fail clearly instead of silently moving to another port.
