# Mobile and Tablet Readiness Audit

FretTrack is still a desktop-first browser app, but the current beta can be made much easier to use on phones and tablets without rewriting the product. This pass focused on responsive layout, touch target sizing, and modal behavior.

## Tested Widths

- `360px` phone portrait
- `768px` tablet portrait
- `1024px` tablet landscape
- desktop behavior checked against the existing layout after the responsive overrides

## Issues Found

- The app shell had a hard `min-width: 1100px`, which forced mobile overflow.
- Forms, toolbars, and detail panes were not collapsing cleanly at tablet widths.
- Job tabs were getting cramped on narrow screens.
- The feedback modal and landing-page application modal needed tighter mobile sizing.
- Several action areas relied on dense button rows that are awkward on touch screens.
- Operator tables were correctly scrollable, but their surrounding controls needed better wrapping.

## Fixes Made

- Added responsive overrides in `src/styles.css` for phone and tablet widths.
- Removed the mobile/desktop overflow pressure by overriding the global `main` min-width on smaller screens.
- Collapsed the app layout to a single column on tablet and mobile widths.
- Tightened forms, summary grids, and job detail layouts so they wrap cleanly instead of crushing fields.
- Increased touch target size for buttons, inputs, selects, and textareas on smaller screens.
- Made job tabs horizontally scrollable on narrow screens so they stay usable without wrapping into a mess.
- Improved modal sizing and spacing for the beta application and feedback dialogs.
- Kept operator tables scrollable while making operator controls wrap better.
- Tuned the public landing page application modal for smaller screens.

## Legacy WebKit Compatibility

FretTrack has a legacy browser compatibility pass for older iPad browsers. The login screen has been smoke-tested on an older iPad/iOS WebKit browser stack and now renders instead of failing to a black screen. The app includes legacy Vite output, runtime polyfill coverage, readable load/error fallbacks, and temporary legacy debug logging for diagnosing older WebKit auth/bootstrap issues.

These devices are useful for beta testing and light shop-floor workflows, but older iOS/iPadOS releases and third-party iOS browsers still share the system WebKit engine and may no longer receive current security updates. Shops should keep devices updated when possible, avoid using unpatched legacy devices for owner/operator administration, and treat older devices as convenience clients rather than primary security-sensitive workstations.

## Remaining Tablet and PWA Candidates

- Tablet intake mode with a slightly different split layout for job entry and detail review.
- Direct camera capture for better photo intake on phones and tablets.
- Signature capture for approvals and pickup workflows.
- PWA install support for a more app-like bench experience.
- Offline draft queue for intake and job notes during spotty shop connectivity.
- Deeper mobile tuning for the damage map and photo review flow after more real bench testing.

## Recommended Next Sprint

1. Keep the responsive shell changes in place and watch real beta usage on phones/tablets.
2. Prioritize the damage map and photo upload experience if those still feel awkward on touch devices.
3. Add tablet intake polish only if shops start working from iPads or similar devices regularly.
4. Hold PWA and offline work until the browser workflow is stable and predictable.

## Guardrails

- No auth logic changed.
- No billing logic changed.
- No database schema or migration changes were needed.
- Print rendering was left intact.
- Desktop layout remains close to the current design.
