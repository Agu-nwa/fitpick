import { colorCompatibilityScore } from "@/lib/recommendation/color";

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return [];
}

export function metadataValue(item: any, key: string): any {
  const verified = item.verifiedMetadata?.[key]?.value;
  if (verified !== undefined && verified !== null && !(Array.isArray(verified) && verified.length === 0) && verified !== "") return verified;

  const ai = item.aiAnalysis?.fields?.[key]?.value;
  if (ai !== undefined && ai !== null && !(Array.isArray(ai) && ai.length === 0) && ai !== "") return ai;

  const legacy: Record<string, string> = {
    primaryColor: "color",
    fabricEstimate: "fabric",
    occasionSuitability: "occasions",
    weatherSuitability: "weather",
    formalityScore: "formality"
  };

  return item[legacy[key] || key];
}

export function metadataList(item: any, key: string): string[] {
  return asList(metadataValue(item, key));
}

function textMatches(target: string, candidates: string[]) {
  const normalizedTarget = normalize(target);
  if (!normalizedTarget) return false;
  return candidates.some((candidate) => {
    const normalized = normalize(candidate);
    return normalized && (normalizedTarget.includes(normalized) || normalized.includes(normalizedTarget));
  });
}

export function formalityScore(item: any, target?: string) {
  if (!target) return 8;
  const candidates = metadataList(item, "formalityScore").concat(metadataList(item, "formality"));
  return textMatches(target, candidates) ? 18 : 6;
}

export function occasionScore(item: any, occasionName = "") {
  const candidates = metadataList(item, "occasionSuitability").concat(metadataList(item, "occasions"));
  if (!occasionName) return 8;
  return textMatches(occasionName, candidates) ? 22 : 5;
}

export function weatherScore(item: any, weatherContext = "") {
  const candidates = metadataList(item, "weatherSuitability").concat(metadataList(item, "weather"));
  if (!weatherContext) return 8;
  return textMatches(weatherContext, candidates) ? 18 : 4;
}

export function seasonScore(item: any, seasonContext = "") {
  const candidates = metadataList(item, "seasonSuitability");
  if (!seasonContext || !candidates.length) return 6;
  return textMatches(seasonContext, candidates) ? 12 : 4;
}

export function freshnessScore(item: any, repeatDays: number) {
  if (!item.lastWornAt) return 14;
  const ageDays = (Date.now() - new Date(item.lastWornAt).getTime()) / 86_400_000;
  return ageDays >= repeatDays ? 14 : 2;
}

export function readinessScore(item: any, allowNeedsCare?: boolean) {
  if (item.condition === "ready") return 14;
  if (item.condition === "needs-care") return allowNeedsCare ? 3 : -60;
  return -4;
}

export function fabricCompatibilityScore(items: any[]) {
  const fabrics = items.map((item) => normalize(metadataValue(item, "fabricComposition") || metadataValue(item, "fabricEstimate"))).filter(Boolean);
  if (!fabrics.length) return 4;
  const hasHeavy = fabrics.some((fabric) => /wool|tweed|leather|denim|thick|heavy/.test(fabric));
  const hasLight = fabrics.some((fabric) => /linen|silk|chiffon|light|breathable/.test(fabric));
  if (hasHeavy && hasLight && items.length > 2) return 7;
  if (new Set(fabrics.map((fabric) => fabric.split(" ")[0])).size <= 2) return 14;
  return 10;
}

export function silhouetteBalanceScore(items: any[]) {
  const silhouettes = items.map((item) => normalize(metadataValue(item, "silhouette") || item.fit)).filter(Boolean);
  if (!silhouettes.length) return 5;
  const hasStructured = silhouettes.some((value) => /tailored|structured|slim|straight|fitted/.test(value));
  const hasVolume = silhouettes.some((value) => /wide|flowy|oversized|relaxed|agbada|kaftan/.test(value));
  if (hasStructured && hasVolume) return 15;
  if (hasStructured || hasVolume) return 11;
  return 8;
}

export function culturalRelevanceScore(items: any[], occasionName = "") {
  const target = normalize(occasionName);
  const culturalContext = /native|traditional|cultural|wedding|church|owambe|aso-ebi|agbada|kaftan|ankara|isiagu/.test(target);
  if (!culturalContext) return 8;

  const hasRelevant = items.some((item) => {
    const text = [
      item.category,
      item.subcategory,
      metadataValue(item, "garmentType"),
      metadataValue(item, "culturalTraditionalRelevance"),
      metadataValue(item, "pattern"),
      metadataValue(item, "fabricEstimate")
    ].map(normalize).join(" ");
    return /native|traditional|agbada|kaftan|isiagu|ankara|aso-oke|aso ebi|lace|senator/.test(text);
  });

  return hasRelevant ? 22 : -12;
}

export function completenessScore(items: any[], desiredCategories: string[]) {
  const present = new Set(items.map((item) => item.category));
  const required = desiredCategories.filter((category) => !["outerwear", "accessories", "bags"].includes(category));
  const missingRequired = required.filter((category) => !present.has(category));
  return Math.max(-35, 18 - missingRequired.length * 16);
}

function hasAny(value: unknown, candidates: string[] = []) {
  const normalized = normalize(value);
  return candidates.some((candidate) => {
    const entry = normalize(candidate);
    return entry && normalized && (normalized.includes(entry) || entry.includes(normalized));
  });
}

export function styleProfileScore(items: any[], styleProfile?: any) {
  if (!styleProfile) return 0;

  let score = 0;
  const favoriteColors = styleProfile.favoriteColors || [];
  const dislikedColors = styleProfile.dislikedColors || [];
  const favoriteBrands = styleProfile.favoriteBrands || [];
  const dislikedBrands = styleProfile.dislikedBrands || [];
  const preferredFits = styleProfile.preferredFits || [];
  const dislikedFits = styleProfile.dislikedFits || [];
  const preferredOccasions = styleProfile.preferredOccasions || [];
  const preferredCategories = styleProfile.preferredCategories || [];
  const avoidedCategories = styleProfile.avoidedCategories || [];
  const culturalPreferences = styleProfile.culturalStylePreferences || [];

  for (const item of items) {
    const color = metadataValue(item, "primaryColor") || item.color;
    const brand = metadataValue(item, "brand");
    const fit = metadataValue(item, "fit") || item.fit;
    const occasions = metadataList(item, "occasionSuitability").concat(item.occasions || []);
    const cultural = metadataValue(item, "culturalTraditionalRelevance");

    if (hasAny(color, favoriteColors)) score += 6;
    if (hasAny(color, dislikedColors)) score -= 12;
    if (hasAny(brand, favoriteBrands)) score += 5;
    if (hasAny(brand, dislikedBrands)) score -= 10;
    if (hasAny(fit, preferredFits)) score += 5;
    if (hasAny(fit, dislikedFits)) score -= 10;
    if (preferredCategories.includes(item.category)) score += 5;
    if (avoidedCategories.includes(item.category)) score -= 16;
    if (occasions.some((occasion: string) => hasAny(occasion, preferredOccasions))) score += 4;
    if (hasAny(cultural, culturalPreferences) || (item.category === "native" && culturalPreferences.length)) score += 5;
  }

  const risk = styleProfile.fashionRiskLevel || "balanced";
  const hasPattern = items.some((item) => /print|pattern|ankara|bold|stripe|check/i.test(`${item.pattern || ""} ${metadataValue(item, "pattern") || ""}`));
  const colorGroups = new Set(items.map((item) => normalize(metadataValue(item, "primaryColor") || item.color)).filter(Boolean));
  if (risk === "conservative" && (hasPattern || colorGroups.size > 3)) score -= 8;
  if (risk === "expressive" && (hasPattern || colorGroups.size > 2)) score += 7;

  if (styleProfile.comfortPriority === "high" && items.some((item) => /comfort|relaxed|loose|soft/i.test(`${metadataValue(item, "fit") || ""} ${metadataValue(item, "fabricEstimate") || ""}`))) {
    score += 5;
  }

  if (styleProfile.luxuryPreference === "high" && items.some((item) => Number(metadataValue(item, "luxuryScore")) >= 7)) {
    score += 5;
  }

  return score;
}

export function memoryPreferenceScore(items: any[], memorySummary?: any, allowRecentRepeat = false) {
  if (!memorySummary?.eventCount) return 0;

  let score = 0;
  const positive = memorySummary.positive || {};
  const negative = memorySummary.negative || {};
  const recent = new Set((memorySummary.recentlyWornItemIds || []).map(String));

  for (const item of items) {
    const id = String(item._id || item.id);
    const color = metadataValue(item, "primaryColor") || item.color;
    const brand = metadataValue(item, "brand");
    const fit = metadataValue(item, "fit") || item.fit;

    if ((positive.itemIds || []).map(String).includes(id)) score += 6;
    if ((negative.itemIds || []).map(String).includes(id)) score -= 16;
    if (!allowRecentRepeat && recent.has(id)) score -= 14;

    if (hasAny(color, positive.colors || [])) score += 4;
    if (hasAny(color, negative.colors || [])) score -= 9;
    if (hasAny(brand, positive.brands || [])) score += 3;
    if (hasAny(brand, negative.brands || [])) score -= 7;
    if (hasAny(fit, positive.fits || [])) score += 4;
    if (hasAny(fit, negative.fits || [])) score -= 8;
    if ((positive.categories || []).includes(item.category)) score += 3;
    if ((negative.categories || []).includes(item.category)) score -= 9;
  }

  return score;
}

export function scoreOutfit(
  items: any[],
  input: {
    occasionName?: string;
    formality?: string;
    weatherContext?: string;
    seasonContext?: string;
    repeatDays: number;
    allowNeedsCare?: boolean;
    desiredCategories?: string[];
    styleProfile?: any;
    memorySummary?: any;
    allowRecentRepeat?: boolean;
  }
) {
  const itemScore = items.reduce(
    (sum, item) =>
      sum +
      occasionScore(item, input.occasionName) +
      formalityScore(item, input.formality) +
      weatherScore(item, input.weatherContext) +
      seasonScore(item, input.seasonContext || input.weatherContext) +
      freshnessScore(item, input.repeatDays) +
      readinessScore(item, input.allowNeedsCare),
    0
  );

  return (
    itemScore +
    colorCompatibilityScore(items) +
    fabricCompatibilityScore(items) +
    silhouetteBalanceScore(items) +
    culturalRelevanceScore(items, input.occasionName) +
    completenessScore(items, input.desiredCategories || []) +
    styleProfileScore(items, input.styleProfile) +
    memoryPreferenceScore(items, input.memorySummary, input.allowRecentRepeat)
  );
}
