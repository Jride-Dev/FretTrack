# Keyboard Repair Module

FretTrack's first Keyboard Repair slice is a dedicated workspace for musical keyboards, synthesizers, digital and stage pianos, MIDI controllers, electric pianos, and organs. It reuses the existing shop-scoped customer, job-number, status, priority, permission, audit, and persistence paths while keeping keyboard bench records separate from guitar and amplifier inspection controls.

Keyboard Repair is a Pro and Enterprise feature. Shop-plan users can open the module and see the upgrade boundary, but they cannot create keyboard work or convert an ordinary job into a keyboard job. If a shop downgrades after using the module, historical keyboard work remains readable while keyboard creation and editing are blocked. The application and PostgreSQL both enforce that boundary.

## First operational slice

- Create a keyboard work order for an existing or newly entered customer.
- Select common keyboard manufacturers and matching models, while retaining editable make/model fields for vintage, boutique, and uncommon equipment.
- Record keyboard type, key count, action, year, serial number, sound engine, power requirements, firmware/OS versions, and included accessories.
- Search active keyboard work and optionally include closed records.
- Record affected keys, keybed/contact observations, power-supply readings, diagnosis, repair work, parts, cleaning, calibration, and final-test notes.
- Compare initial and final checks for key return, velocity, aftertouch, performance controls, panel controls, display, audio, speakers, headphones, MIDI, USB, pedal inputs, memory, and startup behavior.
- Reject stale whole-record saves so one technician cannot silently overwrite another technician's newer keyboard work.

## Persistence and access

A keyboard remains a normal job with `instrumentType: "Keyboard"`. Keyboard-specific fields are stored below `techDetails.keyboard` in the existing JSON technical-details record, so the module does not duplicate customers, work-order numbering, status history, or billing data.

Migration `20260817003514_pro_keyboard_repair_foundation.sql` adds the `keyboard_repair` plan entitlement and a server-side job trigger. The trigger checks both the old and new instrument type, preventing a downgraded shop from editing historical keyboard work or evading the gate by converting the record to another type. The helper is `SECURITY INVOKER`, uses an empty search path, and is not directly executable by application roles.

The first slice does not add a media bucket. Ordinary job photos remain available through the established photo workflow. Keyboard-specific audio, waveform, or MIDI diagnostic evidence can be considered later without weakening the current storage and usage boundaries.

Mains-powered keyboards can contain hazardous voltage. FretTrack records technician-entered observations and measurements only; it does not provide repair procedures.
