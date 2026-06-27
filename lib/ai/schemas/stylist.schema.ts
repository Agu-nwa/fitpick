import { z } from "zod";

export const stylistIntentSchema = z.enum([
  "outfit_request",
  "compare_outfits",
  "improve_outfit",
  "explain_item",
  "packing_help",
  "wardrobe_gap",
  "general_style_advice",
  "shopping_advice_requested",
  "unclear"
]);

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const stylistResponseSchema = z
  .object({
    message: z.string().trim().min(1).max(900),
    intent: stylistIntentSchema,
    recommendedOutfitIds: z.array(objectId).max(5).default([]),
    recommendedItemIds: z.array(objectId).max(12).default([]),
    alternativeItemIds: z.array(objectId).max(12).default([]),
    missingWardrobeCategories: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
    occasionDetected: z.string().trim().max(80).nullable().default(null),
    confidenceScore: z.number().min(0).max(1).default(0),
    stylingTips: z.array(z.string().trim().min(1).max(180)).max(6).default([]),
    followUpQuestions: z.array(z.string().trim().min(1).max(180)).max(3).default([]),
    addLaterSuggestions: z.array(z.string().trim().min(1).max(180)).max(5).default([]),
    safetyWarnings: z.array(z.string().trim().min(1).max(180)).max(5).default([])
  })
  .strict();

export type StylistIntent = z.infer<typeof stylistIntentSchema>;
export type StylistResponse = z.infer<typeof stylistResponseSchema>;
