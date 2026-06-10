# FretTrack Photo Editor

Photo Editor Phase 1 adds practical repair-shop image editing for job photos and damage documentation.

![FretTrack Photo Editor Phase 1](screenshots/photo_editor.jpg)

## Current Scope

- Freehand pen markup
- Arrow, circle, and rectangle tools
- Text captions with draggable repositioning
- Crop
- Brightness adjustment
- Undo, redo, and reset
- Save Copy as the default save mode
- Overwrite Original with explicit confirmation
- Manual background cleanup with transparent PNG output

## Manual Background Cleanup

This is not AI background removal. It does not use bundled ML models and does not send images to third-party cutout APIs.

Phase 1 uses browser canvas pixel operations:

- Magic wand selection based on the clicked background color
- Tolerance slider
- Feather/selection expansion slider
- Invert selection
- Erase brush
- Restore brush
- Checkerboard transparency preview

It works best on simple backgrounds. Busy shop backgrounds and similar colors between the instrument and background may require brush cleanup.

## Save Behavior

Default behavior is Save Copy.

Save Copy:

- Renders the edited image as PNG.
- Uploads it to the existing private `job-images` bucket.
- Creates a new `job_images` record.
- Preserves the original photo.
- Makes the edited copy available in the gallery and customer-facing photo selection.

Overwrite Original:

- Requires confirmation.
- Uploads the edited PNG.
- Updates the existing `job_images` record to point at the edited image.
- Records the previous storage path in edit metadata when derivative metadata is available.

## Metadata

When Supabase is configured, edited-photo provenance is stored in `photo_derivatives`:

- source photo id
- derivative type
- storage path
- edit metadata
- created user/time

Derivative types include `edited`, `background_removed`, `cropped`, and `annotated`.

## Limitations

- The editor is a practical documentation tool, not a full Photoshop replacement.
- Background cleanup is manual and best-effort.
- It does not currently provide layer editing after save.
- Browser canvas limits may affect extremely large images.
