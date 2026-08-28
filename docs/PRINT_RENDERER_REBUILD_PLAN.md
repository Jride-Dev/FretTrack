# Print Renderer Rebuild Plan

## Purpose

Customer Damage Report print rendering was the highest-confidence print blocker in FretTrack. The isolated customer-report renderer is now implemented; the same pattern remains the intended direction for later work-order and invoice renderer extraction.

The next print pass should be a deliberate renderer rebuild, not another global CSS patch cycle.

## Rules

- Do not patch global CSS to chase print bugs.
- Do not reuse the interactive `DamageMap` screen UI as printed document output.
- Do not swap the new renderer into production until screenshot checkpoints match expected output.

## Planned Module Shape

The first isolated print module now lives under:

```text
src/modules/print/
  PrintDamageReport.jsx
  PrintDamageMapFigure.jsx
  printDocumentReady.js
  PrintStyles.css
```

The printable document path should be separate from the interactive workspace path.

## Rebuild Strategy

The renderer rebuild should:

- isolate print rendering from normal screen layout
- use dedicated print-only components
- use dedicated print-only styles
- treat work orders, invoices, and customer reports as document outputs
- avoid sharing interactive coordinate/layout assumptions where they do not belong

## Screenshot Checkpoints

The production swap requires these checkpoints:

### A. Frame / image only

- document frame
- margins
- page sizing
- image placement only

### B. One known marker

- single known saved coordinate
- marker alignment verified against expected print position

### C. Saved marker set

- multiple markers from real saved data
- no collapse, drift, or overlap caused by print coordinate mismatch

### D. Final report layout

- headings
- image
- damage list/table
- page breaks
- final printable report spacing

## Current Blocking Area

The Customer Service and Condition Report is no longer rendered through the interactive Job Detail or Damage Map layout. It now owns its document structure, image stage, marker layer, page sizing, tables, and instrument-specific inspection sections.

Remaining print architecture work is the later extraction of the Job Sheet and invoice outputs into the same isolated module boundary. Those documents continue using their existing stable print paths for now.

## Implemented Checkpoints

- frame and Letter-page margins are scoped to `PrintStyles.css`
- saved marker percentages are clamped and positioned only within the rendered reference image stage
- multiple markers retain their numbered relationship to the condition table
- report tables repeat headers and keep rows together across page breaks
- customer printing waits for all report images and two layout paints before opening the browser print dialog
- amplifier and keyboard reports use their own inspection language; neck measurements remain guitar-family only
