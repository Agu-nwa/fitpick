# Fit-Locked Try-On Foundation

Fit-lock reduces random fit changes in AI previews. It does not make normal image generation exact virtual try-on.

## Why Normal AI Image Generation Is Not Exact Try-On

An AI-generated image can reference wardrobe photos, colors, garment names, and style metadata, but it does not simulate real cloth over a measured body. Without garment measurements, avatar measurements, and garment mesh/simulation data, the output can still alter length, ease, sleeve shape, or drape.

## What Fit Lock Does

Fit-lock stores optional avatar measurements, garment size/fit metadata, stretch, drape, and garment measurements. The preview prompt then tells the model to preserve loose/tight intent, garment length, sleeve shape, native/traditional silhouettes, and shoe proportions.

Fit-lock warnings are shown when:

- Avatar measurements are missing.
- Garment size is unknown.
- Garment measurements are missing.
- Measurements are AI-estimated.
- The garment is intentionally oversized or flowing.

## Accuracy Levels

- Level 1, AI Visualization: inspired by selected items.
- Level 2, Garment-Referenced Preview: uses actual wardrobe item images as references.
- Level 3, Fit-Locked Preview: uses avatar measurements and garment fit metadata to reduce random fit changes.
- Level 4, True 3D Garment Simulation: reserved for real 3D garment assets and simulation.

Current generated image previews should be Level 1, Level 2, or Level 3. FitPick must not show Level 4 until a real simulation provider or internal garment mesh pipeline exists.

## Required Data For Better Fit Accuracy

- Avatar measurements.
- Avatar measurement source and confidence.
- Garment tagged size and size system.
- Garment fit, stretch, and drape.
- Garment measurements when known.
- Garment cutout/texture/reference assets.

## Trust Rules

- Never claim exact fit without real simulation.
- Always show preview accuracy level.
- Always show warnings when measurements are missing.
- Keep measurements user-editable and transparent.
- Do not infer sensitive identity attributes from measurements or cultural clothing preferences.
