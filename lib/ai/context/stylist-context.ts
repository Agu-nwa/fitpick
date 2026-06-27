import { buildSmallWardrobeFallbackContext, buildWardrobeContext } from "@/lib/ai/context/wardrobe-context";
import { sanitizeUserPrompt } from "@/lib/ai/safety/ai-safety";

function compactStyleProfile(profile?: any) {
  if (!profile) return null;
  return {
    favoriteColors: profile.favoriteColors || [],
    dislikedColors: profile.dislikedColors || [],
    favoriteBrands: profile.favoriteBrands || [],
    dislikedBrands: profile.dislikedBrands || [],
    preferredFits: profile.preferredFits || [],
    dislikedFits: profile.dislikedFits || [],
    preferredFormality: profile.preferredFormality ?? null,
    preferredOccasions: profile.preferredOccasions || [],
    culturalStylePreferences: profile.culturalStylePreferences || [],
    preferredCategories: profile.preferredCategories || [],
    avoidedCategories: profile.avoidedCategories || [],
    fashionRiskLevel: profile.fashionRiskLevel || "balanced",
    comfortPriority: profile.comfortPriority || "medium",
    luxuryPreference: profile.luxuryPreference || "medium",
    notes: (profile.notes || []).slice(0, 8)
  };
}

function compactMemorySummary(memorySummary?: any) {
  if (!memorySummary?.eventCount) return null;
  return {
    eventCount: memorySummary.eventCount,
    positive: {
      colors: memorySummary.positive?.colors || [],
      categories: memorySummary.positive?.categories || [],
      brands: memorySummary.positive?.brands || [],
      fits: memorySummary.positive?.fits || []
    },
    negative: {
      colors: memorySummary.negative?.colors || [],
      categories: memorySummary.negative?.categories || [],
      brands: memorySummary.negative?.brands || [],
      fits: memorySummary.negative?.fits || []
    },
    recentlyWornItemIds: (memorySummary.recentlyWornItemIds || []).slice(0, 12),
    occasions: memorySummary.occasions || [],
    culturalContext: memorySummary.culturalContext || [],
    lastEventAt: memorySummary.lastEventAt || null
  };
}

export function buildStylistContext(items: any[], styleProfile?: any, memorySummary?: any) {
  const wardrobe = buildWardrobeContext(items, { limit: 50 });
  return {
    wardrobe,
    styleProfile: compactStyleProfile(styleProfile),
    memorySummary: compactMemorySummary(memorySummary),
    ownedItemIds: wardrobe.map((item) => item.id),
    fallback: buildSmallWardrobeFallbackContext(items)
  };
}

export function buildRecentConversationContext(messages: Array<{ role?: string; content?: string }> = []) {
  return messages
    .slice(-6)
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" as const : "user" as const,
      content: sanitizeUserPrompt(message.content || "").slice(0, 400)
    }))
    .filter((message) => message.content);
}
