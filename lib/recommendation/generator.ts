import { scoreOutfit } from "@/lib/recommendation/scoring";
import { calculatePreferenceBoost } from "@/lib/recommendation/learning";
import { calculateWeatherScore }
  from "@/lib/weather/weather-scoring";

export function generateCombinations(
  wardrobeItems: any[],
  categories: string[],
  scoringInput: any
) {
  const categoryMap: Record<string, any[]> = {};

  // Group wardrobe items by category
  categories.forEach((category) => {
    categoryMap[category] = wardrobeItems
      .filter((item) => item.category === category)
      .slice(0, 5); // Prevent combinational explosion
  });

  const byCategory = (category: string) => categoryMap[category] || [];

  const outfits: any[] = [];

  function pushOutfit(items: any[]) {
    const uniqueItems = items.filter(Boolean).filter((item, index, all) => all.findIndex((candidate) => String(candidate._id) === String(item._id)) === index);
    if (!uniqueItems.length) return;

    let score = scoreOutfit(uniqueItems, scoringInput);

    for (const item of uniqueItems) {
      score += calculateWeatherScore(item, scoringInput.weather || null);
      score += calculatePreferenceBoost(item, scoringInput.preferences);
    }

    outfits.push({ items: uniqueItems, score });
  }

  for (const native of byCategory("native")) {
    for (const shoe of byCategory("shoes").length ? byCategory("shoes") : [null]) {
      pushOutfit([native, shoe, byCategory("accessories")[0]]);
    }
  }

  for (const dress of byCategory("dresses")) {
    for (const shoe of byCategory("shoes").length ? byCategory("shoes") : [null]) {
      pushOutfit([dress, shoe, byCategory("outerwear")[0], byCategory("accessories")[0]]);
    }
  }

  for (const top of byCategory("tops")) {
    for (const bottom of byCategory("bottoms").length ? byCategory("bottoms") : [null]) {
      for (const shoe of byCategory("shoes").length ? byCategory("shoes") : [null]) {
        pushOutfit([top, bottom, shoe, byCategory("outerwear")[0], byCategory("accessories")[0], byCategory("bags")[0]]);
      }
    }
  }

  return outfits.sort(
    (a, b) => b.score - a.score
  );
}
