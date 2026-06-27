import { z } from "zod";
import { wardrobeCategorySchema } from "@/schemas/wardrobe.schema";

export const aiFieldSourceSchema = z.enum(["vision", "ocr", "user_confirmed", "system_inferred"]);

const confidence = z.number().min(0).max(1);

const textValue = z.string().trim().max(500).nullable();
const textListValue = z.array(z.string().trim().min(1).max(80)).max(20).default([]);

export const aiTextFieldSchema = z.object({
  value: textValue,
  confidence,
  source: aiFieldSourceSchema
});

export const aiListFieldSchema = z.object({
  value: textListValue,
  confidence,
  source: aiFieldSourceSchema
});

export const wardrobeAiFieldsSchema = z.object({
  garmentType: aiTextFieldSchema,
  category: aiTextFieldSchema.extend({ value: wardrobeCategorySchema.nullable() }),
  subcategory: aiTextFieldSchema,
  genderPresentation: aiTextFieldSchema,
  primaryColor: aiTextFieldSchema,
  secondaryColors: aiListFieldSchema,
  pattern: aiTextFieldSchema,
  fabricEstimate: aiTextFieldSchema,
  fabricComposition: aiTextFieldSchema,
  size: aiTextFieldSchema,
  brand: aiTextFieldSchema,
  rawLabelText: aiTextFieldSchema,
  countryOfOrigin: aiTextFieldSchema,
  fit: aiTextFieldSchema,
  silhouette: aiTextFieldSchema,
  sleeveLength: aiTextFieldSchema,
  necklineCollar: aiTextFieldSchema,
  length: aiTextFieldSchema,
  texture: aiTextFieldSchema,
  thicknessEstimate: aiTextFieldSchema,
  layeringSuitability: aiTextFieldSchema,
  formalityScore: aiTextFieldSchema,
  luxuryScore: aiTextFieldSchema,
  weatherSuitability: aiListFieldSchema,
  seasonSuitability: aiListFieldSchema,
  occasionSuitability: aiListFieldSchema,
  culturalTraditionalRelevance: aiTextFieldSchema,
  careInstructions: aiListFieldSchema,
  stylingNotes: aiListFieldSchema
});

export const wardrobeAiAnalysisSchema = z.object({
  provider: z.string().trim().max(40),
  model: z.string().trim().max(80),
  status: z.enum(["pending", "suggested", "needs-review", "confirmed", "failed"]),
  labelExtractionStatus: z.enum(["not_provided", "pending", "completed", "partial", "failed"]).default("not_provided"),
  labelWarnings: z.array(z.string().trim().min(1).max(180)).max(10).default([]),
  analyzedAt: z.string().datetime().optional(),
  rawSummary: z.string().trim().max(1200).default(""),
  fields: wardrobeAiFieldsSchema
});

export type WardrobeAiAnalysis = z.infer<typeof wardrobeAiAnalysisSchema>;
export type WardrobeAiFields = z.infer<typeof wardrobeAiFieldsSchema>;
