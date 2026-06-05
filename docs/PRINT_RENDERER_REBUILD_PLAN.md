# Print Renderer Rebuild Plan

## Purpose

Customer Damage Report print rendering is the current highest-confidence blocker in FretTrack.

The next print pass should be a deliberate renderer rebuild, not another global CSS patch cycle.

## Rules

- Do not patch global CSS to chase print bugs.
- Do not reuse the interactive `DamageMap` screen UI as printed document output.
- Do not swap the new renderer into production until screenshot checkpoints match expected output.

## Planned Module Shape

Create an isolated print module later under:

```text
src/modules/print/
  PrintWorkOrder.jsx
  PrintInvoice.jsx
  PrintDamageReport.jsx
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

No production swap should happen until these checkpoints pass:

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

Customer Damage Report print output is the current highest-priority print rebuild target.

It should be treated as the first isolated print document before expanding that same pattern to other printed surfaces as needed.
