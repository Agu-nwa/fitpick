type PreviewStyle = "flat_lay" | "mannequin" | "lifestyle_editorial" | "luxury_lookbook";

function styleInstruction(style?: PreviewStyle) {
  if (style === "mannequin") return "mannequin-inspired styling, clean studio background, garments arranged on a neutral display form without implying exact body fit";
  if (style === "lifestyle_editorial") return "premium lifestyle editorial scene, refined composition, still clearly focused on the owned garments";
  if (style === "luxury_lookbook") return "luxury lookbook composition, elegant spacing, quiet premium styling, high-end catalog lighting";
  return "premium flat lay composition, editorial styling, clean background, elegant spacing, high-end fashion presentation";
}

export function buildImagePreviewPrompt(input: { outfitDescription: string; occasion: string; style?: PreviewStyle }) {
  return `Create a premium AI outfit visualization from owned wardrobe item details only.

Owned outfit:
${input.outfitDescription}

Occasion:
${input.occasion}

Preview style:
${styleInstruction(input.style)}

Hard rules:
- Use only the selected owned wardrobe items described above.
- Do not invent new garments, shoes, bags, accessories, logos, text, or watermarks.
- Do not change garment colors, visible patterns, materials, or core silhouettes.
- If details are uncertain, keep the visualization restrained instead of adding guesses.
- This is a premium visualization, not an exact virtual try-on or body-fit simulation.
- Keep the output polished, modern, and luxury editorial.
- No text in the image.`;
}
