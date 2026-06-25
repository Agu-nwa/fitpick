import { scoreOutfit } from "@/lib/recommendation/scoring";

export function generateCombinations(
  wardrobeItems: any[],
  categories: string[],
  scoringInput: any
) {
  const categoryMap: Record<string, any[]> = {};

  // Group wardrobe by category

  categories.forEach((category) => {
    categoryMap[category] = wardrobeItems
      .filter((item) => item.category === category)
      .slice(0, 5); // Prevent explosion
  });

  const tops = categoryMap["tops"] || [];
  const bottoms = categoryMap["bottoms"] || [];
  const shoes = categoryMap["shoes"] || [];

  const outfits: any[] = [];

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {

        const items = [top, bottom, shoe];

        outfits.push({
          items,
          score: scoreOutfit(items, scoringInput)
        });
      }
    }
  }

  return outfits.sort((a, b) => b.score - a.score);
}