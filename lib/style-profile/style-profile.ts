import type { Types } from "mongoose";
import { StyleProfile } from "@/models/StyleProfile";

type StyleProfilePatch = Partial<{
  favoriteColors: string[];
  dislikedColors: string[];
  favoriteBrands: string[];
  dislikedBrands: string[];
  preferredFits: string[];
  dislikedFits: string[];
  preferredFormality: number | null;
  preferredOccasions: string[];
  culturalStylePreferences: string[];
  preferredCategories: string[];
  avoidedCategories: string[];
  fashionRiskLevel: "conservative" | "balanced" | "expressive";
  comfortPriority: "low" | "medium" | "high";
  luxuryPreference: "low" | "medium" | "high";
  notes: string[];
  inferredFrom: string[];
}>;

function cleanList(values?: string[]) {
  return Array.from(new Set((values || []).map((value) => value.trim().toLowerCase()).filter(Boolean))).slice(0, 20);
}

function topValues(counts: Map<string, number>, minimum = 2) {
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minimum)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value]) => value);
}

function addCount(counts: Map<string, number>, value?: string) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return;
  counts.set(normalized, (counts.get(normalized) || 0) + 1);
}

function metadataValue(item: any, key: string) {
  return item.verifiedMetadata?.[key]?.value ?? item.aiAnalysis?.fields?.[key]?.value ?? item[key];
}

export async function getOrCreateStyleProfile(userId: string | Types.ObjectId) {
  return (
    (await StyleProfile.findOne({ userId })) ||
    (await StyleProfile.create({ userId }))
  );
}

export async function updateStyleProfile(userId: string | Types.ObjectId, patch: StyleProfilePatch) {
  const cleaned: StyleProfilePatch = {};
  const listKeys: Array<keyof StyleProfilePatch> = [
    "favoriteColors",
    "dislikedColors",
    "favoriteBrands",
    "dislikedBrands",
    "preferredFits",
    "dislikedFits",
    "preferredOccasions",
    "culturalStylePreferences",
    "preferredCategories",
    "avoidedCategories",
    "notes",
    "inferredFrom"
  ];

  for (const key of listKeys) {
    if (Array.isArray(patch[key])) (cleaned as any)[key] = cleanList(patch[key] as string[]);
  }

  if (patch.preferredFormality === null || typeof patch.preferredFormality === "number") {
    cleaned.preferredFormality = patch.preferredFormality === null ? null : Math.max(0, Math.min(10, patch.preferredFormality));
  }
  if (patch.fashionRiskLevel) cleaned.fashionRiskLevel = patch.fashionRiskLevel;
  if (patch.comfortPriority) cleaned.comfortPriority = patch.comfortPriority;
  if (patch.luxuryPreference) cleaned.luxuryPreference = patch.luxuryPreference;

  return StyleProfile.findOneAndUpdate({ userId }, { $set: cleaned }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

export function inferStyleSignalsFromWardrobe(items: any[]): StyleProfilePatch {
  const colors = new Map<string, number>();
  const fits = new Map<string, number>();
  const categories = new Map<string, number>();
  const occasions = new Map<string, number>();
  const cultural = new Map<string, number>();
  const brands = new Map<string, number>();

  for (const item of items) {
    addCount(colors, metadataValue(item, "primaryColor") || item.color);
    addCount(fits, metadataValue(item, "fit") || item.fit);
    addCount(categories, item.category);
    for (const occasion of metadataValue(item, "occasionSuitability") || item.occasions || []) addCount(occasions, occasion);
    addCount(brands, metadataValue(item, "brand"));
    const culturalValue = String(metadataValue(item, "culturalTraditionalRelevance") || "").toLowerCase();
    if (/native|traditional|ankara|agbada|kaftan|aso|isiagu|lace|senator/.test(culturalValue) || item.category === "native") {
      addCount(cultural, item.category === "native" ? "native wear" : culturalValue);
    }
  }

  return {
    favoriteColors: topValues(colors, 2),
    preferredFits: topValues(fits, 2),
    preferredCategories: topValues(categories, 2),
    preferredOccasions: topValues(occasions, 2),
    culturalStylePreferences: topValues(cultural, 1),
    favoriteBrands: topValues(brands, 2),
    inferredFrom: items.length ? ["wardrobe"] : []
  };
}

export function mergeStyleSignals(profile: any, signals: StyleProfilePatch): StyleProfilePatch {
  return {
    favoriteColors: cleanList([...(profile.favoriteColors || []), ...(signals.favoriteColors || [])]),
    preferredFits: cleanList([...(profile.preferredFits || []), ...(signals.preferredFits || [])]),
    preferredCategories: cleanList([...(profile.preferredCategories || []), ...(signals.preferredCategories || [])]),
    preferredOccasions: cleanList([...(profile.preferredOccasions || []), ...(signals.preferredOccasions || [])]),
    culturalStylePreferences: cleanList([...(profile.culturalStylePreferences || []), ...(signals.culturalStylePreferences || [])]),
    favoriteBrands: cleanList([...(profile.favoriteBrands || []), ...(signals.favoriteBrands || [])]),
    inferredFrom: cleanList([...(profile.inferredFrom || []), ...(signals.inferredFrom || [])])
  };
}

export function mergeMemorySignals(profile: any, signals: StyleProfilePatch): StyleProfilePatch {
  const keepExplicitDislikes = cleanList([...(profile.dislikedColors || []), ...(signals.dislikedColors || [])]);
  const keepExplicitFits = cleanList([...(profile.dislikedFits || []), ...(signals.dislikedFits || [])]);
  const keepExplicitBrands = cleanList([...(profile.dislikedBrands || []), ...(signals.dislikedBrands || [])]);
  const avoidedCategories = cleanList([...(profile.avoidedCategories || []), ...(signals.avoidedCategories || [])]);

  return {
    favoriteColors: cleanList([...(profile.favoriteColors || []), ...(signals.favoriteColors || [])])
      .filter((value) => !keepExplicitDislikes.includes(value))
      .slice(0, 12),
    dislikedColors: keepExplicitDislikes,
    favoriteBrands: cleanList([...(profile.favoriteBrands || []), ...(signals.favoriteBrands || [])])
      .filter((value) => !keepExplicitBrands.includes(value))
      .slice(0, 12),
    dislikedBrands: keepExplicitBrands,
    preferredFits: cleanList([...(profile.preferredFits || []), ...(signals.preferredFits || [])])
      .filter((value) => !keepExplicitFits.includes(value))
      .slice(0, 12),
    dislikedFits: keepExplicitFits,
    preferredOccasions: cleanList([...(profile.preferredOccasions || []), ...(signals.preferredOccasions || [])]).slice(0, 12),
    culturalStylePreferences: cleanList([...(profile.culturalStylePreferences || []), ...(signals.culturalStylePreferences || [])]).slice(0, 12),
    preferredCategories: cleanList([...(profile.preferredCategories || []), ...(signals.preferredCategories || [])])
      .filter((value) => !avoidedCategories.includes(value))
      .slice(0, 12),
    avoidedCategories,
    inferredFrom: cleanList([...(profile.inferredFrom || []), ...(signals.inferredFrom || [])]).slice(0, 12)
  };
}

export function serializeStyleProfile(profile: any) {
  return {
    id: String(profile._id),
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
    notes: profile.notes || [],
    inferredFrom: profile.inferredFrom || [],
    createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : null,
    updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : null
  };
}
