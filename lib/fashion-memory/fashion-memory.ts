import type { Types } from "mongoose";
import { FashionMemory } from "@/models/FashionMemory";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { WardrobeItem } from "@/models/WardrobeItem";
import { getOrCreateStyleProfile, mergeMemorySignals, updateStyleProfile } from "@/lib/style-profile/style-profile";
import { metadataList, metadataValue } from "@/lib/recommendation/scoring";

export type FashionMemoryType =
  | "outfit_liked"
  | "outfit_disliked"
  | "outfit_saved"
  | "outfit_rejected"
  | "item_worn"
  | "item_favorited"
  | "item_hidden"
  | "recommendation_clicked"
  | "stylist_feedback"
  | "manual_preference";

export type FashionMemorySource =
  | "outfit_ui"
  | "stylist_chat"
  | "wardrobe_detail"
  | "recommendation_engine"
  | "style_profile";

type MemoryEventInput = {
  type: FashionMemoryType;
  itemIds?: string[];
  outfitId?: string | null;
  recommendationId?: string | null;
  occasion?: string | null;
  feedbackText?: string | null;
  rating?: number | null;
  source: FashionMemorySource;
};

type CountMap = Map<string, number>;

const positiveTypes = new Set<FashionMemoryType>(["outfit_liked", "outfit_saved", "item_favorited", "recommendation_clicked"]);
const negativeTypes = new Set<FashionMemoryType>(["outfit_disliked", "outfit_rejected", "item_hidden"]);

function cleanString(value?: string | null, max = 160) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanList(values: unknown[] = [], max = 30) {
  return Array.from(new Set(values.map((value) => cleanString(String(value), 80).toLowerCase()).filter(Boolean))).slice(0, max);
}

function addCount(counts: CountMap, value?: unknown, weight = 1) {
  const normalized = cleanString(String(value || ""), 80).toLowerCase();
  if (!normalized) return;
  counts.set(normalized, (counts.get(normalized) || 0) + weight);
}

function topValues(counts: CountMap, minimum = 1, limit = 8) {
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minimum)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function numberOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function itemMetadata(items: any[]) {
  const colors: string[] = [];
  const categories: string[] = [];
  const brands: string[] = [];
  const fits: string[] = [];
  const culturalContext: string[] = [];
  const season: string[] = [];
  const weather: string[] = [];
  const formalities: number[] = [];

  for (const item of items) {
    colors.push(metadataValue(item, "primaryColor") || item.color);
    categories.push(item.category);
    brands.push(metadataValue(item, "brand"));
    fits.push(metadataValue(item, "fit") || item.fit);
    culturalContext.push(metadataValue(item, "culturalTraditionalRelevance"));
    season.push(...metadataList(item, "seasonSuitability"));
    weather.push(...metadataList(item, "weatherSuitability"), ...(item.weather || []));
    const formality = numberOrNull(metadataValue(item, "formalityScore"));
    if (formality !== null) formalities.push(formality);
  }

  return {
    colors: cleanList(colors),
    categories: cleanList(categories),
    brands: cleanList(brands),
    fits: cleanList(fits),
    formality: formalities.length ? Math.round((formalities.reduce((sum, value) => sum + value, 0) / formalities.length) * 10) / 10 : null,
    culturalContext: cleanList(culturalContext),
    season: cleanList(season),
    weather: cleanList(weather)
  };
}

export async function recordFashionMemory(userId: string | Types.ObjectId, event: MemoryEventInput) {
  const outfitId = event.outfitId || event.recommendationId || null;
  const outfit = outfitId
    ? await OutfitRecommendation.findOne({ _id: outfitId, userId }).lean()
    : null;

  const inputItemIds = cleanList(event.itemIds || []).map(String);
  const itemIds = inputItemIds.length
    ? inputItemIds
    : (outfit?.itemIds || []).map(String);

  const items = itemIds.length
    ? await WardrobeItem.find({ _id: { $in: itemIds }, userId, archivedAt: null }).lean()
    : [];

  const safeItemIds = items.map((item) => item._id);
  const memory = await FashionMemory.create({
    userId,
    type: event.type,
    itemIds: safeItemIds,
    outfitId: outfit?._id || (event.outfitId ? event.outfitId : null),
    recommendationId: outfit?._id || (event.recommendationId ? event.recommendationId : null),
    occasion: cleanString(event.occasion || outfit?.occasion || "", 120) || null,
    feedbackText: cleanString(event.feedbackText, 500) || null,
    rating: typeof event.rating === "number" ? Math.max(1, Math.min(5, event.rating)) : null,
    metadata: itemMetadata(items),
    source: event.source
  });

  if (event.type === "item_worn" && safeItemIds.length) {
    await WardrobeItem.updateMany({ _id: { $in: safeItemIds }, userId }, { $set: { lastWornAt: new Date() } });
  }

  return memory;
}

export async function getRecentFashionMemory(userId: string | Types.ObjectId, limit = 50) {
  return FashionMemory.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .lean();
}

export async function getMemorySummary(userId: string | Types.ObjectId) {
  const events = await getRecentFashionMemory(userId, 80);
  const liked = { colors: new Map(), categories: new Map(), brands: new Map(), fits: new Map(), items: new Map() } as Record<string, CountMap>;
  const disliked = { colors: new Map(), categories: new Map(), brands: new Map(), fits: new Map(), items: new Map() } as Record<string, CountMap>;
  const recentlyWornItemIds: string[] = [];
  const savedItemIds: string[] = [];
  const occasions = new Map<string, number>();
  const culturalContext = new Map<string, number>();
  const season = new Map<string, number>();
  const weather = new Map<string, number>();

  for (const event of events) {
    const ageDays = event.createdAt ? (Date.now() - new Date(event.createdAt).getTime()) / 86_400_000 : 0;
    const recencyWeight = ageDays < 7 ? 3 : ageDays < 30 ? 2 : 1;
    const target = positiveTypes.has(event.type as FashionMemoryType)
      ? liked
      : negativeTypes.has(event.type as FashionMemoryType)
        ? disliked
        : null;

    if (target) {
      for (const itemId of event.itemIds || []) addCount(target.items, String(itemId), recencyWeight);
      for (const color of event.metadata?.colors || []) addCount(target.colors, color, recencyWeight);
      for (const category of event.metadata?.categories || []) addCount(target.categories, category, recencyWeight);
      for (const brand of event.metadata?.brands || []) addCount(target.brands, brand, recencyWeight);
      for (const fit of event.metadata?.fits || []) addCount(target.fits, fit, recencyWeight);
    }

    if (event.type === "item_worn" && ageDays < 14) {
      recentlyWornItemIds.push(...(event.itemIds || []).map(String));
    }

    if (event.type === "outfit_saved") {
      savedItemIds.push(...(event.itemIds || []).map(String));
    }

    addCount(occasions, event.occasion, recencyWeight);
    for (const value of event.metadata?.culturalContext || []) addCount(culturalContext, value, recencyWeight);
    for (const value of event.metadata?.season || []) addCount(season, value, recencyWeight);
    for (const value of event.metadata?.weather || []) addCount(weather, value, recencyWeight);
  }

  return {
    eventCount: events.length,
    positive: {
      itemIds: topValues(liked.items),
      colors: topValues(liked.colors),
      categories: topValues(liked.categories),
      brands: topValues(liked.brands),
      fits: topValues(liked.fits)
    },
    negative: {
      itemIds: topValues(disliked.items),
      colors: topValues(disliked.colors),
      categories: topValues(disliked.categories),
      brands: topValues(disliked.brands),
      fits: topValues(disliked.fits)
    },
    recentlyWornItemIds: cleanList(recentlyWornItemIds, 20),
    savedItemIds: cleanList(savedItemIds, 20),
    occasions: topValues(occasions),
    culturalContext: topValues(culturalContext),
    season: topValues(season),
    weather: topValues(weather),
    lastEventAt: events[0]?.createdAt ? new Date(events[0].createdAt).toISOString() : null
  };
}

export async function inferPreferenceSignalsFromMemory(userId: string | Types.ObjectId) {
  const summary = await getMemorySummary(userId);
  return {
    favoriteColors: summary.positive.colors.slice(0, 5),
    dislikedColors: summary.negative.colors.slice(0, 5),
    favoriteBrands: summary.positive.brands.slice(0, 5),
    dislikedBrands: summary.negative.brands.slice(0, 5),
    preferredFits: summary.positive.fits.slice(0, 5),
    dislikedFits: summary.negative.fits.slice(0, 5),
    preferredOccasions: summary.occasions.slice(0, 5),
    culturalStylePreferences: summary.culturalContext.slice(0, 5),
    preferredCategories: summary.positive.categories.slice(0, 5),
    avoidedCategories: summary.negative.categories.slice(0, 5),
    inferredFrom: summary.eventCount ? ["memory: liked outfits", "memory: saved outfits"] : []
  };
}

export async function applyMemorySignalsToStyleProfile(userId: string | Types.ObjectId) {
  const [profile, signals] = await Promise.all([
    getOrCreateStyleProfile(userId),
    inferPreferenceSignalsFromMemory(userId)
  ]);
  return updateStyleProfile(userId, mergeMemorySignals(profile, signals));
}

export function serializeMemorySummary(summary: any) {
  return {
    eventCount: summary?.eventCount || 0,
    positive: summary?.positive || { itemIds: [], colors: [], categories: [], brands: [], fits: [] },
    negative: summary?.negative || { itemIds: [], colors: [], categories: [], brands: [], fits: [] },
    recentlyWornItemIds: summary?.recentlyWornItemIds || [],
    savedItemIds: summary?.savedItemIds || [],
    occasions: summary?.occasions || [],
    culturalContext: summary?.culturalContext || [],
    season: summary?.season || [],
    weather: summary?.weather || [],
    lastEventAt: summary?.lastEventAt || null
  };
}
