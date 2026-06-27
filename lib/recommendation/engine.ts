import { colorCompatibilityScore, colorNote } from "@/lib/recommendation/color";
import { inferOccasionGroup, missingCoreCategories, structureFor } from "@/lib/recommendation/outfit-structures";
import { buildReasonChips } from "@/lib/recommendation/reason-chips";
import {
  fabricCompatibilityScore,
  metadataList,
  metadataValue,
  scoreOutfit,
  silhouetteBalanceScore
} from "@/lib/recommendation/scoring";
import { generateCombinations } from "@/lib/recommendation/generator";
import { serializeWardrobeItem } from "@/lib/wardrobe";

export function repeatWindowDays(preference?: string) {
  if (preference === "high") return 30;
  if (preference === "low") return 7;
  return 14;
}

function freshnessNote(items: any[], repeatDays: number) {
  const recent = items.filter(
    (item) =>
      item.lastWornAt &&
      (Date.now() - new Date(item.lastWornAt).getTime()) / 86_400_000 <
      repeatDays
  );

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

  return items.some((item) =>
    item.weather?.some(
      (tag: string) =>
        target.includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(target)
    )
  );
}

function itemLabel(item: any) {
  return item.name || [item.color, item.subcategory || item.category].filter(Boolean).join(" ") || item.category;
}

function hasCulturalSignal(items: any[]) {
  return items.some((item) =>
    [
      item.category,
      item.subcategory,
      metadataValue(item, "garmentType"),
      metadataValue(item, "culturalTraditionalRelevance"),
      metadataValue(item, "pattern"),
      metadataValue(item, "fabricEstimate")
    ]
      .join(" ")
      .toLowerCase()
      .match(/native|traditional|agbada|kaftan|isiagu|ankara|aso-oke|aso ebi|lace|senator/)
  );
}

function confidenceFromScore(score: number) {
  if (score >= 185) return "Strong match";
  if (score >= 115) return "Good match";
  return "Needs review";
}

function boundedConfidenceScore(score: number) {
  return Math.max(0, Math.min(1, Math.round((score / 220) * 100) / 100));
}

function buildFashionExplanation(input: {
  items: any[];
  occasion: string;
  occasionGroup: string;
  weatherContext?: string;
  missing: string[];
  score: number;
}) {
  const itemNames = input.items.map(itemLabel);
  const fabrics = input.items
    .map((item) => metadataValue(item, "fabricComposition") || metadataValue(item, "fabricEstimate") || item.fabric)
    .filter(Boolean);
  const silhouettes = input.items
    .map((item) => metadataValue(item, "silhouette") || item.fit)
    .filter(Boolean);
  const cultural = hasCulturalSignal(input.items);
  const missingText = input.missing.length ? ` Missing ${input.missing.join(", ")} keeps this from being fully complete.` : "";

  return {
    occasionFit:
      input.occasionGroup === "cultural" || cultural
        ? "Grounded in owned native or culturally relevant wardrobe pieces where available."
        : `Built from owned wardrobe pieces for ${input.occasion}.`,
    whyItWorks: `${itemNames.join(", ")} create a wearable ${input.occasion.toLowerCase()} look from actual wardrobe items.${missingText}`,
    materialNote: fabrics.length
      ? `Material read: ${fabrics.slice(0, 3).join(", ")}. Compatibility score ${fabricCompatibilityScore(input.items)}.`
      : "Fabric data is limited, so FitPick used category and occasion fallback logic.",
    silhouetteNote: silhouettes.length
      ? `Silhouette read: ${silhouettes.slice(0, 3).join(", ")}. Balance score ${silhouetteBalanceScore(input.items)}.`
      : "Silhouette data is limited, so FitPick avoided overclaiming fit balance.",
    improvementNote: input.missing.length
      ? `This outfit would improve with owned ${input.missing.join(" and ")} options.`
      : "No major wardrobe gap detected for this recommendation.",
    addLater: input.missing.length
      ? `Optional add later: a versatile ${input.missing[0]} that matches your wardrobe.`
      : "",
    stylingTips: [
      input.occasionGroup === "formal" ? "Keep grooming and footwear polished for the event." : "Keep proportions clean and intentional.",
      cultural ? "Let the traditional piece lead; keep supporting items restrained." : "Use accessories only if they support the outfit, not compete with it.",
      input.weatherContext ? "Check weather before leaving and swap outerwear if needed." : "Review weather before wearing."
    ]
  };
}

export type EngineInput = {
  occasionName?: string;
  occasionGroup?: string;
  formality?: string;
  weatherContext?: string;
  allowNeedsCare?: boolean;
  styleDirection?: string;
  preferences?: any;
  styleProfile?: any;
  memorySummary?: any;
  wardrobeItems: any[];
  previousLooks?: any[];
  wornLooks?: any[];
  weather?: any;
};

export function buildRecommendation(input: EngineInput) {
  const repeatDays = repeatWindowDays(
    input.preferences?.repeatSensitivity
  );
  const allowRecentRepeat = /repeat|again|same look|rewear/i.test(`${input.occasionName || ""} ${input.styleDirection || ""}`);

  const occasionGroup = inferOccasionGroup({
    name: input.occasionName,
    group: input.occasionGroup,
    weatherContext: input.weatherContext
  });

  const desiredStructure = structureFor(occasionGroup);

  const available = input.wardrobeItems.filter((item) => {
    if (item.archivedAt) return false;

    if (
      item.condition === "needs-care" &&
      !input.allowNeedsCare
    ) {
      return false;
    }

    return true;
  });

  const readyFirst = available
    .filter((item) => item.condition !== "missing-tags")
    .concat(
      available.filter(
        (item) => item.condition === "missing-tags"
      )
    );

  // Generate and score outfit combinations

  const missing = missingCoreCategories(readyFirst, desiredStructure);

  const combinations = generateCombinations(
    readyFirst,
    desiredStructure,
    {
      occasionName: input.occasionName,
      formality: input.formality,
      weatherContext: input.weatherContext,
      seasonContext: input.weatherContext,
      repeatDays,
      allowNeedsCare: input.allowNeedsCare,
      desiredCategories: desiredStructure,
      styleProfile: input.styleProfile,
      memorySummary: input.memorySummary,
      allowRecentRepeat,
      previousLooks: input.previousLooks || []
    }
  );

  const bestOutfit = combinations[0];

  const coreItems: any[] = bestOutfit?.items || [];

  if (!coreItems.length) {
    return {
      title: "No outfit found",
      occasion: input.occasionName || "Today",
      confidence: "Needs review",
      summary:
        "Add more wardrobe items to receive recommendations.",
      items: [],
      reasonChips: [],
      weatherContext: input.weatherContext || "",
      repetitionNote: "",
      careNote: "",
      colorNote: "",
      swapGroups: [],
      occasionFit: "No suitable owned wardrobe combination was found.",
      whyItWorks: "FitPick could not assemble a complete look from the currently available owned items.",
      materialNote: "",
      silhouetteNote: "",
      improvementNote: missing.length ? `Add or verify ${missing.join(", ")} items to unlock stronger recommendations.` : "Add more verified wardrobe metadata.",
      addLater: missing.length ? `Optional add later: ${missing[0]}.` : "",
      confidenceScore: 0,
      stylingTips: ["Add more verified wardrobe items, then request this occasion again."]
    };
  }

  const score = scoreOutfit(coreItems, {
    occasionName: input.occasionName,
    formality: input.formality,
    weatherContext: input.weatherContext,
    seasonContext: input.weatherContext,
    repeatDays,
    allowNeedsCare: input.allowNeedsCare,
    desiredCategories: desiredStructure,
    styleProfile: input.styleProfile,
    memorySummary: input.memorySummary,
    allowRecentRepeat
  });

  const confidence = confidenceFromScore(score);


  const chips = buildReasonChips({
    occasionReady: coreItems.length >= 2,

    colorBalanced:
      colorCompatibilityScore(coreItems) >= 13,

    weatherAware: isWeatherAware(
      coreItems,
      input.weatherContext
    ),

    fresh: !coreItems.some(
      (item: any) =>
        item.lastWornAt &&
        (Date.now() -
          new Date(item.lastWornAt).getTime()) /
        86_400_000 <
        repeatDays
    ),

    comfort:
      input.styleDirection === "comfortable" ||
      coreItems.some((item: any) =>
        item.fit?.toLowerCase().includes("comfort")
      ),

    polished: coreItems.some((item: any) =>
      ["shoes", "outerwear", "accessories"].includes(
        item.category
      )
    ),

    eventAware:
      occasionGroup === "cultural" ||
      occasionGroup === "formal"
  });

  const occasion = input.occasionName || "Today";
  const explanation = buildFashionExplanation({
    items: coreItems,
    occasion,
    occasionGroup,
    weatherContext: input.weatherContext,
    missing,
    score
  });
  const styleProfileNote = input.styleProfile
    ? ` Style DNA considered: ${[
        input.styleProfile.fashionRiskLevel ? `${input.styleProfile.fashionRiskLevel} risk` : "",
        input.styleProfile.comfortPriority ? `${input.styleProfile.comfortPriority} comfort` : "",
        input.styleProfile.favoriteColors?.length ? `colors ${input.styleProfile.favoriteColors.slice(0, 3).join(", ")}` : ""
      ].filter(Boolean).join("; ")}.`
    : "";
  const memoryNote = input.memorySummary?.eventCount
    ? ` Fashion Memory considered: recent likes, saves, rejections, and worn items were used gently.`
    : "";

  return {
    title: `${occasion} outfit`,
    occasion,
    confidence,
    summary: `${explanation.whyItWorks}${styleProfileNote}${memoryNote} Confidence ${Math.round(boundedConfidenceScore(score) * 100)}%.`,
    items: coreItems,
    reasonChips: chips,
    weatherContext: input.weatherContext || "",
    repetitionNote: freshnessNote(
      coreItems,
      repeatDays
    ),
    careNote: careNote(coreItems),
    colorNote: colorNote(coreItems),
    swapGroups: buildSwapGroups(coreItems, available),
    confidenceScore: boundedConfidenceScore(score),
    ...explanation
  };
}

export function buildSwapGroups(
  selectedItems: any[],
  availableItems: any[]
) {
  return selectedItems.map((item) => ({
    category: item.category,
    itemIds: availableItems
      .filter(
        (candidate) =>
          candidate.category === item.category &&
          String(candidate._id) !== String(item._id)
      )
      .slice(0, 4)
      .map((candidate) => String(candidate._id)),
    warningChips: warningChips(item)
  }));
}

export function warningChips(item: any) {
  const chips: string[] = [];

  if (item.condition === "needs-care")
    chips.push("Needs care");

  if (
    item.lastWornAt &&
    (Date.now() - new Date(item.lastWornAt).getTime()) /
    86_400_000 <
    7
  ) {
    chips.push("Recently worn");
  }

  if (!item.weather?.length)
    chips.push("Lower match");

  return chips;
}

export function serializeOutfit(
  outfit: any,
  items: any[]
) {
  return {
    id: String(outfit._id),
    title:
      outfit.title ||
      `${outfit.occasion || "Today"} outfit`,
    occasion: outfit.occasion || "",
    confidence: outfit.confidence,
    summary: outfit.summary || "",
    items: items.map(serializeWardrobeItem),
    reasonChips: outfit.reasonChips || [],
    weatherContext: outfit.weatherContext || "",
    weatherFit:
      outfit.weatherContext ||
      "No weather context provided.",
    occasionFit: outfit.occasionFit || "",
    whyItWorks: outfit.whyItWorks || outfit.summary || "",
    materialNote: outfit.materialNote || "",
    silhouetteNote: outfit.silhouetteNote || "",
    improvementNote: outfit.improvementNote || "",
    addLater: outfit.addLater || "",
    confidenceScore: outfit.confidenceScore || 0,
    stylingTips: outfit.stylingTips || [],
    preview: outfit.preview || {
      status: "not_started",
      provider: "",
      storageKey: "",
      imageUrl: "",
      cacheKey: "",
      promptVersion: "",
      model: "",
      generatedAt: null,
      errorMessage: "",
      attempts: 0
    },
    colorNote:
      outfit.colorNote || colorNote(items),
    repeatNote:
      outfit.repetitionNote ||
      "No recent repeat found.",
    repetitionNote:
      outfit.repetitionNote ||
      "No recent repeat found.",
    careNote:
      outfit.careNote || careNote(items),
    swapGroups:
      outfit.swapGroups ||
      buildSwapGroups(items, items),
    createdAt: outfit.createdAt
      ? new Date(outfit.createdAt).toISOString()
      : undefined
  };
}
