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

export const stylistVisualModeSchema = z.enum(["none", "premium_preview", "digital_human"]);
export const stylistAvatarPreviewStatusSchema = z.enum(["not_started", "queued", "generating", "ready", "failed"]);

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const stylistAvatarPreviewSchema = z
  .object({
    status: stylistAvatarPreviewStatusSchema.default("not_started"),
    jobId: objectId.nullable().default(null),
    previewId: objectId.nullable().default(null),
    imageUrl: z.string().trim().max(2048).nullable().default(null),
    cacheKey: z.string().trim().max(260).nullable().default(null),
    errorMessage: z.string().trim().max(220).nullable().default(null)
  })
  .strict();

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
    safetyWarnings: z.array(z.string().trim().min(1).max(180)).max(5).default([]),
    visualMode: stylistVisualModeSchema.default("none"),
    outfitRecommendationId: objectId.nullable().default(null),
    avatarPreview: stylistAvatarPreviewSchema.default({
      status: "not_started",
      jobId: null,
      previewId: null,
      imageUrl: null,
      cacheKey: null,
      errorMessage: null
    }),
    visualizationDisclaimer: z
      .string()
      .trim()
      .max(180)
      .default("AI visualization, not exact virtual try-on.")
  })
  .strict();

export type StylistIntent = z.infer<typeof stylistIntentSchema>;
export type StylistVisualMode = z.infer<typeof stylistVisualModeSchema>;
export type StylistAvatarPreview = z.infer<typeof stylistAvatarPreviewSchema>;
export type StylistResponse = z.infer<typeof stylistResponseSchema>;
