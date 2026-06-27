function fieldValue(item: any, key: string) {
  const verified = item.verifiedMetadata?.[key]?.value;
  if (verified !== undefined && verified !== null && verified !== "") return verified;
  const ai = item.aiAnalysis?.fields?.[key]?.value;
  if (ai !== undefined && ai !== null && ai !== "") return ai;
  const legacy: Record<string, string> = {
    primaryColor: "color",
    fabricEstimate: "fabric",
    occasionSuitability: "occasions",
    weatherSuitability: "weather",
    seasonSuitability: "season",
    formalityScore: "formality"
  };
  return item[legacy[key] || key];
}

function list(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function compactWardrobeItemContext(item: any, options: { includeImageUrl?: boolean } = {}) {
  return {
    id: String(item._id),
    name: item.name || "unnamed",
    category: item.category || "unknown",
    garmentType: fieldValue(item, "garmentType") || item.subcategory || "unknown",
    color: fieldValue(item, "primaryColor") || item.color || "unknown",
    secondaryColors: list(fieldValue(item, "secondaryColors")),
    fabric: fieldValue(item, "fabricComposition") || fieldValue(item, "fabricEstimate") || item.fabric || "unknown",
    fit: fieldValue(item, "fit") || item.fit || "unknown",
    silhouette: fieldValue(item, "silhouette") || "unknown",
    occasions: list(fieldValue(item, "occasionSuitability")).concat(list(item.occasions)).slice(0, 10),
    weather: list(fieldValue(item, "weatherSuitability")).concat(list(item.weather)).slice(0, 10),
    season: list(fieldValue(item, "seasonSuitability")).slice(0, 10),
    formality: fieldValue(item, "formalityScore") || "unknown",
    culturalRelevance: fieldValue(item, "culturalTraditionalRelevance") || "unknown",
    ...(options.includeImageUrl ? { imageUrl: item.imageUrl || item.thumbnailUrl || "" } : {})
  };
}

export function buildWardrobeContext(items: any[], options: { includeImageUrl?: boolean; limit?: number } = {}) {
  return items.slice(0, options.limit || 60).map((item) => compactWardrobeItemContext(item, options));
}

export function buildSmallWardrobeFallbackContext(items: any[]) {
  if (items.length >= 3) return "";
  return "Wardrobe is small. Give a graceful answer, use only owned items, and explain missing categories without inventing them.";
}
