# True 3D Garment Simulation Roadmap

True 3D simulation means a garment mesh or digitized pattern is fitted to a measured avatar with a simulation provider or internal cloth system. FitPick does not have this yet.

## Roadmap

1. Store original wardrobe photos.
2. Generate image cutouts and studio variants.
3. Create texture references and flat-lay garment assets.
4. Capture user-confirmed avatar and garment measurements.
5. Add 2D pattern or 3D garment mesh assets.
6. Connect CLO, Browzwear, PICTOFiT-style SDK, or custom cloth simulation.
7. Render animated avatar try-on with front, back, side, walking, and 360 views.

## Provider Options

- PICTOFiT-style SDK for commercial virtual try-on integration.
- CLO/Browzwear-style garment digitization for production-grade apparel assets.
- Custom cloth simulation for long-term control and higher engineering cost.
- Internal preview provider for current AI visualization and fit-lock prompts.

## Current Provider Behavior

`internal_preview` uses the existing Digital Human image preview pipeline with fit-lock constraints.

`pictofit`, `clo_pipeline`, `browzwear_pipeline`, and `custom` are architecture placeholders until API credentials, SDKs, garment assets, and workflow contracts are selected.

## Level 4 Requirements

FitPick can label a preview as True 3D Garment Simulation only when it has:

- Real avatar measurements.
- Garment measurements.
- Simulation-ready garment mesh or digitized pattern.
- A provider result or internal simulation output.
- Clear model/preview/animation metadata.

Until then, FitPick must use “AI Visualization,” “Garment-Referenced,” or “Fit-Locked” language.
