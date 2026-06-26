export type WardrobeItem = {
  id: string;
  category?: string;
  color?: string;
  fabric?: string;
};

export type OutfitSuggestion = {
  title: string;
  items: WardrobeItem[];
  reason: string;
};

export function generateFallbackOutfits(items: WardrobeItem[]) {
  if (!items || items.length === 0) {
    return {
      message: "No wardrobe items found. Upload clothes to get outfit suggestions.",
      outfits: []
    };
  }

  const tops = items.filter(i => i.category === "tops");
  const bottoms = items.filter(i => i.category === "bottoms");
  const shoes = items.filter(i => i.category === "shoes");

  const outfits: OutfitSuggestion[] = [];

  // Outfit 1: basic match
  if (tops.length && bottoms.length) {
    outfits.push({
      title: "Casual Everyday Look",
      items: [tops[0], bottoms[0], shoes[0]].filter(Boolean),
      reason: "Simple balanced outfit for daily use"
    });
  }

  // Outfit 2: fallback mix
  if (tops.length) {
    outfits.push({
      title: "Clean Minimal Look",
      items: [tops[0], bottoms[1] || bottoms[0]].filter(Boolean),
      reason: "Minimal styling based on available tops"
    });
  }

  // Outfit 3: fallback single piece styling
  if (tops.length || bottoms.length) {
    outfits.push({
      title: "Simple Style Option",
      items: [tops[0] || bottoms[0]].filter(Boolean),
      reason: "Basic styling fallback option"
    });
  }

  return {
    message: "AI unavailable — showing smart fallback outfits",
    outfits
  };
}
