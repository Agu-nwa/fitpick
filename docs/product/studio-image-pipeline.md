# FitPick Studio Image Pipeline

## What It Does

The Studio Image Pipeline prepares wardrobe photos for premium cards and future avatar workflows. Each wardrobe image slot can store variants:

- `original`
- `cutout`
- `studio`
- `thumbnail`

The current implementation preserves original images, records variant metadata, and supports a real remove.bg provider for cutout and studio PNG generation.

## Provider Options

Environment variables:

- `BACKGROUND_REMOVAL_PROVIDER=none | replicate | removebg | custom`
- `BACKGROUND_REMOVAL_API_KEY=`
- `FITPICK_STUDIO_BACKGROUND_PRESET=luxury_dark | ivory | soft_gradient | editorial_gray | transparent`

If the provider is `none` or credentials are missing, FitPick returns `unavailable` and keeps the original image. It does not pretend to remove backgrounds.

When `BACKGROUND_REMOVAL_PROVIDER=removebg`, FitPick downloads the owned original wardrobe image server-side, sends it to remove.bg as `image_file`, uploads the transparent cutout PNG to S3, then requests a studio-background PNG using the configured preset color and uploads that to S3.

## Studio Background Presets

- `luxury_dark`
- `ivory`
- `soft_gradient`
- `editorial_gray`
- `transparent`

Presets include label, description, background metadata, and recommended garment categories.

## S3 Storage

Successful providers use these storage patterns:

- `wardrobe/{userId}/{uploadId}/{slot}/original-{timestamp}.jpg`
- `wardrobe/{userId}/{uploadId}/{slot}/cutout-{timestamp}.png`
- `wardrobe/{userId}/{uploadId}/{slot}/studio-{preset}-{timestamp}.png`
- `wardrobe/{userId}/{uploadId}/{slot}/thumb-{timestamp}.jpg`

MongoDB stores only metadata and URLs. It must not store long-term Base64 image payloads.

## Failure Behavior

Background processing is non-blocking. If it fails or is unavailable:

- Upload still succeeds.
- Confirmation still works.
- Wardrobe cards fall back to original images.
- Users see safe processing status instead of raw provider errors.

## Security

Processing jobs carry IDs, image slots, owned storage keys, and preset names only. They do not include secrets, signed URLs, raw Base64, or arbitrary client-provided image URLs.

## Roadmap

- Optional Replicate or custom segmentation adapter.
- Garment cutout thumbnails.
- Rich local studio compositing for gradient or image backgrounds.
- Garment segmentation model.
- True garment digitisation pipeline.
