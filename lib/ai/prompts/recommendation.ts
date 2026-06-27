export function buildRecommendationExplanationPrompt(input: { wardrobeContext: unknown; occasion: string }) {
  return `Explain a FitPick outfit using only this owned wardrobe context. Do not invent item IDs or garments.

Wardrobe context:
${JSON.stringify(input.wardrobeContext)}

Occasion:
${input.occasion}

Return concise JSON only if used by a caller.`;
}
