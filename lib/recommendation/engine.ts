import { colorCompatibilityScore, colorNote } from "@/lib/recommendation/color";
import { inferOccasionGroup, structureFor } from "@/lib/recommendation/outfit-structures";
import { buildReasonChips } from "@/lib/recommendation/reason-chips";
import { scoreOutfit } from "@/lib/recommendation/scoring";
import { serializeWardrobeItem } from "@/lib/wardrobe";

export function repeatWindowDays(preference?: string) {
  if (preference === "high") return 30;
  if (preference === "low") return 7;
  return 14;
}

function freshnessNote(items: any[], repeatDays: number) {
  const recent = items.filter((item) => item.lastWornAt && (Date.now() - new Date(item.lastWornAt).getTime()) / 86_400_000 < repeatDays);
  if (!recent.length) return "No recent repeat found.";
  return "One item was worn recently; consider swapping if repeat sensitivity matters today.";
}

function careNote(items: any[]) {
  return items.some((item) => item.condition === "needs-care")
    ? "One item may need care before wearing."
    : "Selected items are marked ready.";
}

function isWeatherAware(items: any[], weatherContext = "") {
  if (!weatherContext) return false;
  const target = weatherContext.toLowerCase();
  return items.some((item) => item.weather?.some((tag: string) => target.includes(tag.toLowerCase()) || tag.toLowerCase().includes(target)));
}

function candidateScore(item: any, input: EngineInput, repeatDays: number) {
  return scoreOutfit([item], {
    occasionName: input.occasionName,
    formality: input.formality,
    weatherContext: input.weatherContext,
    repeatDays,
    allowNeedsCare: input.allowNeedsCare
  });
}

function selectItemForCategory(items: any[], category: string, selectedIds: Set<string>, input: EngineInput, repeatDays: number) {
  const primary = items.filter((item) => item.category === category && !selectedIds.has(String(item._id)));
  const candidates = primary.length ? primary : items.filter((item) => !selectedIds.has(String(item._id)));
  const sorted = candidates.sort((a, b) => candidateScore(b, input, repeatDays) - candidateScore(a, input, repeatDays));
  return sorted[0] || null;
}

export type EngineInput = {
  occasionName?: string;
  occasionGroup?: string;
  formality?: string;
  weatherContext?: string;
  allowNeedsCare?: boolean;
  styleDirection?: string;
  preferences?: any;
  wardrobeItems: any[];
  wornLooks?: any[];
};

export function buildRecommendation(input: EngineInput) {
  const repeatDays = repeatWindowDays(input.preferences?.repeatSensitivity);
  const occasionGroup = inferOccasionGroup({
    name: input.occasionName,
    group: input.occasionGroup,
    weatherContext: input.weatherContext
  });
  const desiredStructure = structureFor(occasionGroup);
  const available = input.wardrobeItems.filter((item) => {
    if (item.archivedAt) return false;
    if (item.condition === "needs-care" && !input.allowNeedsCare) return false;
    return true;
  });
  const readyFirst = available
    .filter((item) => item.condition !== "missing-tags")
    .concat(available.filter((item) => item.condition === "missing-tags"));

  const selected: any[] = [];
  const selectedIds = new Set<string>();

  for (const category of desiredStructure) {
    if (category === "outerwear" || category === "accessories" || category === "bags") {
      const optional = selectItemForCategory(readyFirst, category, selectedIds, input, repeatDays);
      if (optional && selected.length >= 2) {
        selected.push(optional);
        selectedIds.add(String(optional._id));
      }
      continue;
    }

    const item = selectItemForCategory(readyFirst, category, selectedIds, input, repeatDays);
    if (item) {
      selected.push(item);
      selectedIds.add(String(item._id));
    }
  }

  const coreItems = selected.slice(0, 5);
  const score = scoreOutfit(coreItems, {
    occasionName: input.occasionName,
    formality: input.formality,
    weatherContext: input.weatherContext,
    repeatDays,
    allowNeedsCare: input.allowNeedsCare
  });
  const confidence = score >= 145 ? "Strong match" : score >= 95 ? "Good match" : "Needs review";
  const chips = buildReasonChips({
    occasionReady: coreItems.length >= 2,
    colorBalanced: colorCompatibilityScore(coreItems) >= 13,
    weatherAware: isWeatherAware(coreItems, input.weatherContext),
    fresh: !coreItems.some((item) => item.lastWornAt && (Date.now() - new Date(item.lastWornAt).getTime()) / 86_400_000 < repeatDays),
    comfort: input.styleDirection === "comfortable" || coreItems.some((item) => item.fit?.toLowerCase().includes("comfort")),
    polished: coreItems.some((item) => ["shoes", "outerwear", "accessories"].includes(item.category)),
    eventAware: occasionGroup === "cultural" || occasionGroup === "formal"
  });

  const occasion = input.occasionName || "Today";

  return {
    title: `${occasion} outfit`,
    occasion,
    confidence,
    summary:
      coreItems.length >= 2
        ? `A ${confidence.toLowerCase()} outfit built from ${coreItems.length} wardrobe item${coreItems.length === 1 ? "" : "s"}.`
        : "Add more ready wardrobe items to improve this recommendation.",
    items: coreItems,
    reasonChips: chips,
    weatherContext: input.weatherContext || "",
    repetitionNote: freshnessNote(coreItems, repeatDays),
    careNote: careNote(coreItems),
    colorNote: colorNote(coreItems),
    swapGroups: buildSwapGroups(coreItems, available)
  };
}

export function buildSwapGroups(selectedItems: any[], availableItems: any[]) {
  return selectedItems.map((item) => ({
    category: item.category,
    itemIds: availableItems
      .filter((candidate) => candidate.category === item.category && String(candidate._id) !== String(item._id))
      .slice(0, 4)
      .map((candidate) => String(candidate._id)),
    warningChips: warningChips(item)
  }));
}

export function warningChips(item: any) {
  const chips: string[] = [];
  if (item.condition === "needs-care") chips.push("Needs care");
  if (item.lastWornAt && (Date.now() - new Date(item.lastWornAt).getTime()) / 86_400_000 < 7) chips.push("Recently worn");
  if (!item.weather?.length) chips.push("Lower match");
  return chips;
}

export function serializeOutfit(outfit: any, items: any[]) {
  return {
    id: String(outfit._id),
    title: outfit.title || `${outfit.occasion || "Today"} outfit`,
    occasion: outfit.occasion || "",
    confidence: outfit.confidence,
    summary: outfit.summary || "",
    items: items.map(serializeWardrobeItem),
    reasonChips: outfit.reasonChips || [],
    weatherContext: outfit.weatherContext || "",
    weatherFit: outfit.weatherContext || "No weather context provided.",
    colorNote: outfit.colorNote || colorNote(items),
    repeatNote: outfit.repetitionNote || "No recent repeat found.",
    repetitionNote: outfit.repetitionNote || "No recent repeat found.",
    careNote: outfit.careNote || careNote(items),
    swapGroups: outfit.swapGroups || buildSwapGroups(items, items),
    createdAt: outfit.createdAt ? new Date(outfit.createdAt).toISOString() : undefined
  };
}
