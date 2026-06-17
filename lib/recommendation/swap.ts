import { buildRecommendation, serializeOutfit } from "@/lib/recommendation/engine";

export function buildSwappedPayload(input: {
  outfit: any;
  currentItems: any[];
  replacement: any;
  itemIdToReplace: string;
  wardrobeItems: any[];
}) {
  const nextItems = input.currentItems.map((item) =>
    String(item._id) === input.itemIdToReplace ? input.replacement : item
  );
  const rebuilt = buildRecommendation({
    occasionName: input.outfit.occasion,
    weatherContext: input.outfit.weatherContext,
    wardrobeItems: nextItems,
    allowNeedsCare: true
  });

  return serializeOutfit(
    {
      ...input.outfit.toObject?.(),
      _id: input.outfit._id,
      confidence: rebuilt.confidence,
      reasonChips: rebuilt.reasonChips,
      summary: "Updated outfit with one swapped item.",
      repetitionNote: rebuilt.repetitionNote,
      careNote: rebuilt.careNote,
      colorNote: rebuilt.colorNote,
      swapGroups: rebuilt.swapGroups
    },
    nextItems
  );
}
