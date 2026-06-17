import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");

export const outfitRecommendationRequestSchema = z.object({
  occasionId: objectId.optional(),
  customOccasion: z
    .object({
      name: z.string().trim().min(2).max(80),
      group: z.enum(["everyday", "work", "formal", "social", "cultural", "weather", "travel"]).optional(),
      formality: z.enum(["relaxed", "balanced", "polished", "formal"]).optional()
    })
    .optional(),
  occasionName: z.string().trim().min(2).max(80).optional(),
  formality: z.enum(["relaxed", "balanced", "polished", "formal"]).optional(),
  weatherContext: z.string().trim().max(120).optional(),
  constraints: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  allowNeedsCare: z.boolean().optional(),
  styleDirection: z.enum(["simple", "polished", "bold", "native", "weather-safe", "comfortable"]).optional()
});

export const outfitIdSchema = z.object({
  id: objectId
});

export const swapOutfitSchema = z.object({
  itemIdToReplace: objectId,
  replacementItemId: objectId.optional(),
  category: z.string().trim().max(60).optional(),
  swapDirection: z
    .enum(["best-match", "more-polished", "more-casual", "color-change", "weather-safe", "native-touch"])
    .optional()
});

export const saveOutfitSchema = z.object({
  title: z.string().trim().max(120).optional(),
  favorite: z.boolean().optional()
});

export const wearOutfitSchema = z.object({
  wornAt: z.string().datetime().optional(),
  rating: z.enum(["Perfect", "Good", "Okay", "Not today", "Not my style"]).optional()
});

export const outfitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedbackTags: z
    .array(
      z.enum([
        "perfect",
        "good",
        "too-casual",
        "too-formal",
        "wrong-color",
        "not-my-style",
        "not-today",
        "weather-issue",
        "needs-native-touch"
      ])
    )
    .max(10)
    .optional(),
  note: z.string().trim().max(500).optional()
});

export const looksQuerySchema = z.object({
  tab: z.enum(["saved", "worn", "favorites", "all"]).optional(),
  occasion: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: objectId.optional()
});
