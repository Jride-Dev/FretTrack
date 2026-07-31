# System Status and Uptime

FretTrack's status banner combines two different signals:

- The green, yellow, or red status shows the current health reported for the Supabase and Cloudflare services FretTrack depends on.
- **FretTrack uptime** shows the time since the most recently resolved incident involving one of those monitored provider services.

The uptime clock uses the official Supabase and Cloudflare status feeds. FretTrack monitors Supabase API Gateway, Auth, Database, Realtime, and Storage, plus Cloudflare Pages, Workers, and Workers Assets. Provider history is refreshed every 30 minutes, while the displayed clock advances locally between refreshes.

## Why did the uptime reset?

The clock resets when Supabase or Cloudflare reports that an incident affecting a monitored service has been resolved. A reset does **not** necessarily mean that:

- the FretTrack application restarted;
- FretTrack was redeployed;
- every FretTrack shop experienced an interruption; or
- FretTrack itself was unstable.

Provider status incidents can be global, regional, or limited to a subset of customers. Because the public provider feeds do not reliably identify whether one specific FretTrack shop or project was affected, the banner uses the conservative time since the latest relevant provider recovery.

For example, if Supabase resolves a Database or API Gateway incident at 6:26 AM, the displayed FretTrack uptime starts again from 6:26 AM even when a particular shop did not notice an interruption.

## What the clock means

Treat the clock as a shared-infrastructure recovery indicator, not a formal service-level measurement or proof of continuous application availability. When investigating a reset, open the Supabase and Cloudflare links in the banner to review their current status and incident history.

An operator-declared FretTrack incident takes priority over the provider summary and displays its own incident status and duration.
