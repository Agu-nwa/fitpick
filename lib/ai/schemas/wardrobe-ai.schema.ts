import { z } from "zod";
import { wardrobeCategorySchema } from "@/schemas/wardrobe.schema";

export const aiFieldSourceSchema = z.enum([
  "vision",
  "ocr",
  "logo_detection",
  "entity_resolver",
  "user_confirmed",
  "system_inferred"
]);

const confidence = z.number().min(0).max(1);

const textValue = z.string().trim().max(500).nullable();
const numberValue = z.number().min(0).max(1).nullable();
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

export const aiNumberFieldSchema = z.object({
  value: numberValue,
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
  taggedSize: aiTextFieldSchema.extend({ value: z.enum(["XS", "S", "M", "L", "XL", "XXL", "custom", "unknown"]).nullable() }).default({ value: "unknown", confidence: 0, source: "system_inferred" }),
  sizeSystem: aiTextFieldSchema.extend({ value: z.enum(["US", "UK", "EU", "NG", "international", "custom", "unknown"]).nullable() }).default({ value: "unknown", confidence: 0, source: "system_inferred" }),
  garmentFit: aiTextFieldSchema.extend({ value: z.enum(["slim", "regular", "relaxed", "oversized", "tailored", "flowing", "unknown"]).nullable() }).default({ value: "unknown", confidence: 0, source: "vision" }),
  stretchLevel: aiTextFieldSchema.extend({ value: z.enum(["none", "low", "medium", "high", "unknown"]).nullable() }).default({ value: "unknown", confidence: 0, source: "vision" }),
  fabricDrape: aiTextFieldSchema.extend({ value: z.enum(["structured", "soft", "flowing", "heavy", "stiff", "unknown"]).nullable() }).default({ value: "unknown", confidence: 0, source: "vision" }),
  fitConfidence: aiNumberFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  measurementSource: aiTextFieldSchema.extend({ value: z.enum(["label_ocr", "user_confirmed", "ai_estimated", "manual", "unknown"]).nullable() }).default({ value: "unknown", confidence: 0, source: "system_inferred" }),
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
  recognizedEntity: aiTextFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  entityType: aiTextFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  entityConfidence: aiNumberFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  sportCategory: aiTextFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  teamOrNation: aiTextFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  clubOrFederation: aiTextFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  playerName: aiTextFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  playerNumber: aiTextFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  kitType: aiTextFieldSchema.extend({ value: z.enum(["home", "away", "third", "training", "unknown"]).nullable() }).default({ value: "unknown", confidence: 0, source: "vision" }),
  seasonEstimate: aiTextFieldSchema.default({ value: null, confidence: 0, source: "vision" }),
  logoDetections: aiListFieldSchema.default({ value: [], confidence: 0, source: "logo_detection" }),
  textDetections: aiListFieldSchema.default({ value: [], confidence: 0, source: "ocr" }),
  brandSignals: aiListFieldSchema.default({ value: [], confidence: 0, source: "logo_detection" }),
  entityWarnings: aiListFieldSchema.default({ value: [], confidence: 0, source: "entity_resolver" }),
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
