# Image Optimization Before Storage Upload

FretTrack now optimizes repair and shop images in the browser before Supabase Storage upload. The original full-size phone-camera file is not uploaded.

## Current Defaults

- Job photos: JPEG, longest side 1600px, quality 0.78.
- Damage/reference photos: JPEG, longest side 1200px, quality 0.80.
- Shop logos: JPEG, longest side 800px, quality 0.85.
- Small images are re-encoded to strip metadata, but they are not upscaled.
- EXIF/GPS metadata is stripped by canvas-based conversion.
- Files larger than 10 MB before optimization are allowed, but flagged in metadata.
- Optimized files over 2 MB are blocked with a retry-friendly error.

## Supported Inputs

- JPG/JPEG
- PNG
- WebP
- HEIC/HEIF when browser-side decoding/conversion succeeds

If browser decoding or HEIC conversion fails, the upload is rejected with a clear message. FretTrack does not silently upload the original full-size image.

## Stored Metadata

`job_images` stores:

- `original_filename`
- `stored_filename`
- `original_size_bytes`
- `optimized_size_bytes`
- `mime_type`
- `width`
- `height`
- `optimization_version`

The storage path and private authenticated download flow remain unchanged.

## Photo Editor Phase 1

Photo Editor Phase 1 builds on the same private job-photo storage model.

- Edited photos render client-side through browser canvas and save as PNG.
- Save Copy is the default and creates a new `job_images` record so the edited image appears in the gallery and can be selected for customer-facing output.
- Overwrite Original requires explicit confirmation and updates the existing `job_images` record to point at the edited PNG.
- `photo_derivatives` stores source-photo/edit metadata for provenance when Supabase is configured.
- Manual background cleanup uses canvas pixel operations only. It does not use ML models or third-party image cutout APIs.

![FretTrack Photo Editor Phase 1](screenshots/photo_editor.jpg)

## Smoke Checklist

- 12MP phone JPEG becomes smaller and the longest side is no more than 1600px.
- PNG screenshots convert to JPEG and compress correctly.
- Small images are not upscaled.
- Shop logos still look good at 800px max dimension.
- Job sheet and customer report images still render.
- Private authenticated image download still works.
- Storage paths and RLS behavior remain unchanged.
- Failed compression shows a clear error and does not upload the original.
- Edited-photo Save Copy preserves the original image and adds a new PNG copy.
- Overwrite Original shows the warning confirmation before replacing the image record.

## Future Paid-Tier Option

A future Pro/archive module could allow higher-resolution originals or archival copies. Basic/Solo should continue storing optimized images only.
