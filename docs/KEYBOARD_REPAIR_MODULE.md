# Keyboard Repair Module

FretTrack's first Keyboard Repair slice is a dedicated workspace for musical keyboards, synthesizers, digital and stage pianos, MIDI controllers, electric pianos, and organs. It reuses the existing shop-scoped customer, job-number, status, priority, permission, audit, and persistence paths while keeping keyboard bench records separate from guitar and amplifier inspection controls.

Keyboard Repair is a Pro and Enterprise feature. Shop-plan users can open the module and see the upgrade boundary, but they cannot create keyboard work or convert an ordinary job into a keyboard job. If a shop downgrades after using the module, historical keyboard work remains readable while keyboard creation and editing are blocked. The application and PostgreSQL both enforce that boundary.

## Operational workflow

- Create a keyboard work order for an existing or newly entered customer.
- Select common keyboard manufacturers and matching models, while retaining editable make/model fields for vintage, boutique, and uncommon equipment.
- Record keyboard type, key count, action, year, serial number, sound engine, power requirements, firmware/OS versions, and included accessories.
- Search active keyboard work and optionally include closed records.
- Record affected keys, keybed/contact observations, power-supply readings, diagnosis, repair work, parts, cleaning, calibration, and final-test notes.
- Compare initial and final checks for key return, velocity, aftertouch, performance controls, panel controls, display, audio, speakers, headphones, MIDI, USB, pedal inputs, memory, and startup behavior.
- Reject stale whole-record saves so one technician cannot silently overwrite another technician's newer keyboard work.
- Record sensor technology and the lowest MIDI note alongside the make, model, serial number, key count, and action.
- Click an interactive keybed map to store per-key pass/fault state, standardized fault code, severity, velocity range, and technician notes.
- Paste raw MIDI monitor output and keep a concise MIDI diagnostic summary in the repair history.
- Follow instrument-family diagnostic paths for pianos, synths/workstations, MIDI controllers, organs, and uncommon keyboards, including ribbon-cable and diode-matrix checks.
- Cross-reference failed contacts, sensors, springs, keytops, and related faults against active shop inventory, then turn a request into an ordinary FretTrack job part through the existing stock transaction.
- Review keyboard workload, average completed repair time, most-serviced model, and most common logged key fault on the module dashboard.
- Send a customer diagnostic email assembled from the saved profile, fault map, diagnosis, requested parts, and current job costs through the existing consent, quota, history, and provider workflow.

## Persistence and access

A keyboard remains a normal job with `instrumentType: "Keyboard"`. Keyboard-specific fields are stored below `techDetails.keyboard` in the existing JSON technical-details record, so the module does not duplicate customers, work-order numbering, status history, or billing data.

Migration `20260817003514_pro_keyboard_repair_foundation.sql` adds the `keyboard_repair` plan entitlement and a server-side job trigger. The trigger checks both the old and new instrument type, preventing a downgraded shop from editing historical keyboard work or evading the gate by converting the record to another type. The helper is `SECURITY INVOKER`, uses an empty search path, and is not directly executable by application roles.

Migration `20260817005658_keyboard_repair_crm_workflow.sql` adds `keyboard_key_states` and `keyboard_part_requests`. Both tables are linked to the authoritative job, use explicit Data API grants, enable RLS, preserve historical read access after downgrade, and require current job write access plus the Keyboard Repair entitlement for mutations. Per-key and parts-request updates compare `updated_at` so a stale technician view is rejected instead of overwriting a newer finding.

Migration `20260817011009_keyboard_part_request_fulfillment.sql` makes inventory fulfillment atomic and idempotent. It locks the request, creates the existing inventory-backed job part, decrements stock, records the inventory movement, and marks the request installed in one database transaction. Retrying or double-clicking an already fulfilled request returns the same job part instead of consuming stock twice.

Migration `20260817011534_harden_keyboard_repair_workflow.sql` makes key and request identity fields immutable, prevents installed requests from being reopened, and removes direct client access to the fulfillment-link column. Only the checked atomic fulfillment function can attach a job part to a request.

The module does not add a media bucket or a browser MIDI-device connection. Ordinary job photos remain available through the established photo workflow, while MIDI evidence is deliberately captured as pasted diagnostic text. Real-time MIDI hardware acquisition can be considered later without coupling core CRM records to browser or device availability.

Mains-powered keyboards can contain hazardous voltage. FretTrack records technician-entered observations and measurements only; it does not provide repair procedures.
