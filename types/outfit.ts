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
  occasionFit?: string;
  whyItWorks?: string;
  materialNote?: string;
  silhouetteNote?: string;
  improvementNote?: string;
  addLater?: string;
  confidenceScore?: number;
  stylingTips?: string[];
  repeatNote: string;
  careNote: string;
  source?: "rule_based" | "manual" | "ai_placeholder" | "ai" | "outfit_page" | "stylist_chat" | "system" | string;
  createdAt?: string;
  preview?: {
    status: "not_started" | "generating" | "ready" | "failed" | string;
    provider?: string;
    storageKey?: string;
    imageUrl?: string;
    cacheKey?: string;
    promptVersion?: string;
    model?: string;
    generatedAt?: string | null;
    errorMessage?: string;
    attempts?: number;
  };
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

export type StylistIntent =
  | "outfit_request"
  | "compare_outfits"
  | "improve_outfit"
  | "explain_item"
  | "packing_help"
  | "wardrobe_gap"
  | "general_style_advice"
  | "shopping_advice_requested"
  | "unclear";

export type StylistVisualMode = "none" | "premium_preview" | "digital_human";

export type StylistAvatarPreview = {
  status: "not_started" | "queued" | "generating" | "ready" | "failed" | string;
  jobId: string | null;
  previewId: string | null;
  imageUrl: string | null;
  cacheKey: string | null;
  errorMessage: string | null;
};

export type StylistResponse = {
  message: string;
  intent: StylistIntent;
  recommendedOutfitIds: string[];
  recommendedItemIds: string[];
  alternativeItemIds: string[];
  missingWardrobeCategories: string[];
  occasionDetected: string | null;
  confidenceScore: number;
  stylingTips: string[];
  followUpQuestions: string[];
  addLaterSuggestions: string[];
  safetyWarnings: string[];
  visualMode?: StylistVisualMode;
  outfitRecommendationId?: string | null;
  avatarPreview?: StylistAvatarPreview;
  visualizationDisclaimer?: string;
};
