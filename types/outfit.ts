import type { WardrobeItem } from "./wardrobe";

export type OutfitConfidence = "Strong match" | "Good match" | "Needs review";

export type OutfitRecommendation = {
  id: string;
  title: string;
  occasion: string;
  confidence: OutfitConfidence;
  items: WardrobeItem[];
  reasonChips: string[];
  summary: string;
  weatherFit: string;
  colorNote: string;
  repeatNote: string;
  careNote: string;
  createdAt?: string;
  swapGroups?: Array<{
    category: string;
    itemIds: string[];
    warningChips: string[];
  }>;
};

export type WornLook = OutfitRecommendation & {
  wornOn: string;
};

export type OutfitRating = "Perfect" | "Good" | "Okay" | "Not today" | "Not my style";
