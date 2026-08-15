# Amplifier Repair Module

FretTrack's first Amplifier Repair slice is a separate workspace page rather than another guitar Job Detail tab. It reuses the established customer, job-number, status, priority, permission, audit, and job-persistence paths while keeping amplifier bench records isolated from guitar neck, string, and damage-map controls.

## Included workflow

- Create an amplifier work order for an existing or newly entered customer.
- Select common amplifier manufacturers and their matching models from a shared preset catalog, or enter boutique, vintage, and custom make/model values without restriction.
- Record amplifier make, model, year, serial number, format, and technology.
- Search active amplifier work and optionally include closed work orders.
- Open a dedicated amplifier detail page from either Amplifier Repair or Current Jobs.
- Record rated power, channels, speaker configuration and impedance, mains voltage, and tube complement.
- Record separate baseline and final AC mains, B+, plate, bias, dissipation, transformer, speaker, load, signal-level, output-power, continuity, and signal-tracing measurements.
- Record reported symptoms, safety notes, diagnosis, repair performed, parts replaced, bench-test notes, and final-test status.
- Record firmware/software versions and customer-reported trigger conditions for digital and modeling amplifiers.
- Capture microphone audio or attach audio produced through a properly isolated dummy-load/DI path for noise-floor, sweep, clipping, and intermittent-fault tests.
- Attach oscilloscope waveform and RTA/spectrum screenshots as private diagnostic evidence.
- Edit status, priority, customer contact information, and promise date through the existing job update path.
- Preserve read-only role restrictions, dirty-state warnings, global Save Job behavior, and Close Detail return navigation.

## Persistence boundary

An amplifier remains a normal shop-scoped job with `instrumentType: "Amplifier"`; amplifier-only bench fields and electrical measurements are stored below `techDetails.amplifier` in the existing JSON technical-details record. Existing guitar jobs and historical job values are not rewritten.

The make/model presets live in the shared instrument catalog used by both generic Job intake and the dedicated Amplifier Repair screens. Selecting or typing a recognized make narrows the model suggestions to that manufacturer. Both controls remain editable, so the catalog never prevents an unlisted or custom value from being saved.

Migration `20260814215521_amplifier_job_evidence.sql` adds only the persistent evidence boundary required for media: a private `job-evidence` Storage bucket and a `job_evidence` metadata table. Table and object policies reuse `private.can_access_job` and `private.can_write_job`, so evidence inherits the linked job's shop isolation and role permissions. Evidence files are restricted to approved audio/image formats and 25 MB per file. The bucket is separate from repair-photo rendering, while uploads reuse the existing atomic reservation and storage-byte ledger so diagnostic media cannot bypass the shop's configured upload/storage allowance.

Tube-amplifier voltages can be lethal. FretTrack only records technician-entered values and displays a qualified-technician warning; it does not provide measurement procedures.

This is deliberately a focused operational foundation. Shared job billing, parts, work logs, photos, documents, and scheduling remain in their established modules and can be connected to the amplifier workspace in later slices without copying their persistence logic. A separately labeled diagnostic-evidence allowance remains a future product option; the current foundation conservatively counts evidence uploads and bytes through the established media limits.
