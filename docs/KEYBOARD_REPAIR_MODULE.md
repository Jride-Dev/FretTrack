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
- Click a responsive, horizontally scrollable SVG keybed to mark a key Good or Defective, classify structural/electrical/dirty/clean state, and store a standardized fault, severity, velocity range, and technician note.
- Paste raw MIDI monitor output, preview unmatched zero-velocity triggers and missing note-off events on the keybed, and deliberately apply those findings without treating a normal velocity-zero note-off as a defect.
- Follow instrument-family diagnostic paths for pianos, synths/workstations, MIDI controllers, organs, and uncommon keyboards, including ribbon-cable and diode-matrix checks.
- Cross-reference failed contacts, sensors, springs, keytops, and related faults against active shop inventory, then turn a request into an ordinary FretTrack job part through the existing stock transaction.
- Switch the same saved job between Keyboard Bench and Work Order, Parts & Payments to add inventory/manual parts, labor, tax, discounts, payments, balances, invoice email, print documents, photos, scheduling, messages, and timeline history.
- Review keyboard workload, average completed repair time, most-serviced model, and most common logged key fault on the module dashboard.
- Send a customer diagnostic email assembled from the saved profile, fault map, diagnosis, requested parts, and current job costs through the existing consent, quota, history, and provider workflow.

## Persistence and access

A keyboard remains a normal job with `instrumentType: "Keyboard"`. Keyboard-specific fields are stored below `techDetails.keyboard` in the existing JSON technical-details record, so the module does not duplicate customers, work-order numbering, status history, or billing data.

The Work Order, Parts & Payments view reuses the existing Job Detail commercial controls and opens directly on Parts & Billing. It persists across refresh until the technician returns to Keyboard Bench, and both directions retain the established unsaved-change guard.

Migration `20260817003514_pro_keyboard_repair_foundation.sql` adds the `keyboard_repair` plan entitlement and a server-side job trigger. The trigger checks both the old and new instrument type, preventing a downgraded shop from editing historical keyboard work or evading the gate by converting the record to another type. The helper is `SECURITY INVOKER`, uses an empty search path, and is not directly executable by application roles.

Migration `20260817012310_normalize_keyboard_damage_map.sql` projects each keyboard work order into a normalized `keyboard_profiles` row, replaces the first-pass key-state table with `key_damage_map`, and migrates existing findings and parts-request links without changing their IDs. `fault_codes` provides a read-only standardized catalog, while `keyboard_part_compatibility` links shop inventory to exact keytops, key groups such as 12-note rubber strips, or full keybeds. All exposed tables use explicit Data API grants and RLS; damage-map and parts-request writes retain job permission, current entitlement, identity guards, and optimistic concurrency.

The parts matcher ranks explicit compatibility rows first, then uses fault keywords and instrument/key context as a fallback. An exact replacement key can be scoped by note name, color, manufacturer, model pattern, or key-index range. Grouped components record how many keys the part services while inventory quantity remains the number of physical strips or assemblies consumed.

Migration `20260817011009_keyboard_part_request_fulfillment.sql` makes inventory fulfillment atomic and idempotent. It locks the request, creates the existing inventory-backed job part, decrements stock, records the inventory movement, and marks the request installed in one database transaction. Retrying or double-clicking an already fulfilled request returns the same job part instead of consuming stock twice.

Migration `20260817011534_harden_keyboard_repair_workflow.sql` makes key and request identity fields immutable, prevents installed requests from being reopened, and removes direct client access to the fulfillment-link column. Only the checked atomic fulfillment function can attach a job part to a request.

The module does not add a media bucket or a browser MIDI-device connection. Ordinary job photos remain available through the established photo workflow, while MIDI evidence is deliberately captured and parsed from pasted diagnostic text. Real-time MIDI hardware acquisition can be considered later without coupling core CRM records to browser or device availability.

Mains-powered keyboards can contain hazardous voltage. FretTrack records technician-entered observations and measurements only; it does not provide repair procedures.
