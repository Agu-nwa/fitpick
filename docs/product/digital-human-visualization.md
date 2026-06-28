# FitPick Digital Human Visualization

## What It Does

Digital Human Preview is FitPick's premium avatar outfit visualization layer. It lets users create a Digital Human profile with safe presets, load a Ready Player Me or custom HTTPS GLB avatar, view that avatar in a client-side 3D studio, and generate an AI Avatar Outfit Preview from verified owned wardrobe items.

FitPick should describe this as:

- Digital Human Preview
- Avatar Outfit Preview
- AI fashion visualization

## What It Does Not Do

This feature is not exact body-measurement virtual try-on. It does not claim exact garment fit, real cloth physics, body-accurate sizing, or perfect 360-degree garment simulation from photos.

## Data Stored

FitPick stores:

- Avatar profile presets such as gender presentation, body preset, height preset, pose, visualization style, and provider.
- Optional user-entered body measurements, measurement source, measurement confidence, and fit preference.
- Optional HTTPS GLB avatar URL.
- User consent that the preview is AI fashion visualization, not exact virtual try-on.
- Avatar preview metadata such as user ID, outfit ID, avatar profile ID, item IDs, cache key, model, prompt version, status, S3 storage key, and CloudFront/S3 image URL.

Generated avatar preview images are stored in S3 and served through CloudFront-ready URLs. MongoDB stores metadata only, not long-term Base64 image payloads.

## Privacy Boundaries

Avatar profile data must stay transparent and user-editable. Body measurements are optional fit-visualization data and must not be used to infer health, ethnicity, sexuality, religion, political views, or precise location from avatar settings, wardrobe data, or generated previews.

Cultural styling is allowed only as fashion context, such as native wear, ankara, agbada, kaftan, aso-ebi, isiagu, lace, or senator wear.

## Security Boundaries

- Avatar profile routes require the authenticated user.
- Client requests never provide `userId`.
- Preview generation loads outfits and wardrobe items by the authenticated user's ownership.
- Ready Player Me and custom avatar links must be HTTPS `.glb` URLs.
- Script URLs, unsafe protocols, embedded credentials, and non-GLB links are rejected.
- Background jobs carry IDs and safe options only, never Base64, secrets, or raw provider payloads.
- Raw OpenAI/S3 errors are not exposed to users.

## Roadmap

- Ready Player Me deep integration.
- 360-degree GLB viewer refinements.
- Pose animation.
- Walking animation.
- Real-time mix-and-match outfit mapping.
- MetaHuman/Unreal path later.
- Garment segmentation and background removal later.
- True virtual try-on later, only when measurement, fit, and cloth simulation accuracy can be represented honestly.
