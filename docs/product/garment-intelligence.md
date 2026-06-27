# FitPick Advanced Garment Intelligence

## What It Does

Advanced Garment Intelligence upgrades FitPick's wardrobe analysis from generic tagging to structured recognition signals. It can attempt to identify sports jerseys, national or club kits, visible brand signals, luxury/designer items, and native/traditional garments when visual evidence, OCR text, logos, colors, or garment metadata support it.

Example supported outputs include:

- `Portugal National Team Jersey`
- `Manchester United Jersey`
- `Chelsea Jersey`
- `Nigerian Super Eagles Jersey`
- `Agbada`
- `Senator wear`
- `Kaftan`
- `Isiagu`
- `Ankara`
- `Aso-ebi`

## What It Does Not Guarantee

FitPick does not guarantee perfect logo recognition, brand authentication, season accuracy, player identification, or sports kit database matching in this phase. If evidence is weak, fields must remain `unknown` or `null`, and the confirmation screen asks the user to verify.

## Data Model

Advanced recognition fields are stored inside AI analysis and user-confirmed metadata:

- `recognizedEntity`
- `entityType`
- `entityConfidence`
- `sportCategory`
- `teamOrNation`
- `clubOrFederation`
- `playerName`
- `playerNumber`
- `kitType`
- `seasonEstimate`
- `logoDetections`
- `textDetections`
- `brandSignals`
- `entityWarnings`

Each AI-derived field keeps `value`, `confidence`, and `source`.

## Resolver Strategy

FitPick combines vision output, OCR/label text, visible text detections, logo or brand signals, category, color, pattern, and cultural relevance. A deterministic entity resolver runs after Vision + OCR so common cases, such as a visible Portugal football jersey, can be strengthened without depending only on the LLM.

## Privacy Boundary

Sports and cultural labels are fashion context only. `Portugal jersey` is not a nationality claim. `Native wear` is not an ethnicity claim. `Church outfit` remains occasion context, not a religion claim.

## Roadmap

- Dedicated logo recognition.
- Sports kit database.
- Luxury brand classifier.
- Brand-authentication confidence.
- Season/edition resolver.
- True garment digitisation pipeline.
