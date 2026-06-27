import { z } from "zod";
import { wardrobeCategorySchema, wardrobeConditionSchema } from "@/schemas/wardrobe.schema";
import { wardrobeAiAnalysisSchema } from "@/lib/ai/schemas/wardrobe-ai.schema";

const tagList = z.array(z.string().trim().min(1).max(40)).max(20).default([]);

export const aiSuggestedWardrobeTagsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: wardrobeCategorySchema.optional(),
  subcategory: z.string().trim().max(80).optional().or(z.literal("")),
  color: z.string().trim().max(60).optional().or(z.literal("")),
  pattern: z.string().trim().max(60).optional().or(z.literal("")),
  fabric: z.string().trim().max(60).optional().or(z.literal("")),
  fit: z.string().trim().max(60).optional().or(z.literal("")),
  formality: tagList,
  occasions: tagList,
  weather: tagList,
  condition: wardrobeConditionSchema.optional(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean()
});

export const aiTaggingResultSchema = z.object({
  ok: z.boolean(),
  provider: z.enum(["mock", "gemini", "openai"]),
  aiTagStatus: z.enum(["completed", "failed", "needs-review"]),
  suggestedTags: aiSuggestedWardrobeTagsSchema.optional(),
  aiAnalysis: wardrobeAiAnalysisSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  safeMessage: z.string().trim().max(180).optional()
});
