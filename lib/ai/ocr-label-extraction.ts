import { z } from "zod";
import { openai } from "@/lib/ai/openai";
import { aiCache, createCacheKey } from "@/lib/ai/cache/ai-cache";
import { getAiModel } from "@/lib/ai/models/registry";
import { errorCategory, logAiEvent } from "@/lib/ai/observability/ai-logger";
import { buildLabelExtractionPrompt } from "@/lib/ai/prompts";
import { safeAIError, sanitizeExtractedText } from "@/lib/ai/safety/ai-safety";
import {
  aiListFieldSchema,
  aiTextFieldSchema,
  type WardrobeAiFields
} from "@/lib/ai/schemas/wardrobe-ai.schema";
import { safeParseJson, validateJsonResponse } from "@/lib/ai/validation/response-validator";
import type { WardrobeImageAsset } from "@/types/ai-tagging";

export type LabelExtraction = Partial<Pick<WardrobeAiFields, "brand" | "size" | "fabricComposition" | "careInstructions">>;

export const labelExtractionSchema = z
  .object({
    rawLabelText: aiTextFieldSchema.extend({ source: z.literal("ocr") }),
    size: aiTextFieldSchema.extend({ source: z.literal("ocr") }),
    brand: aiTextFieldSchema.extend({ source: z.literal("ocr") }),
    fabricComposition: aiTextFieldSchema.extend({ source: z.literal("ocr") }),
    careInstructions: aiListFieldSchema.extend({ source: z.literal("ocr") }),
    countryOfOrigin: aiTextFieldSchema.extend({ source: z.literal("ocr") }),
    warnings: z.array(z.string().trim().min(1).max(180)).max(10).default([])
  })
  .strict();

export type DedicatedLabelExtraction = z.infer<typeof labelExtractionSchema>;

export function labelFieldsFromAnalysis(fields: WardrobeAiFields): LabelExtraction {
  return {
    brand: fields.brand,
    size: fields.size,
    fabricComposition: fields.fabricComposition,
    careInstructions: fields.careInstructions
  };
}

export async function extractLabelMetadata(labelImage?: WardrobeImageAsset): Promise<{
  ok: boolean;
  status: "not_provided" | "completed" | "partial" | "failed";
  extraction?: DedicatedLabelExtraction;
  warnings: string[];
}> {
  const ocrModel = getAiModel("ocrLabel");
  if (!labelImage?.url) {
    return {
      ok: true,
      status: "not_provided",
      warnings: ["No label image was provided."]
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      status: "failed",
      warnings: ["Label extraction is unavailable."]
    };
  }

  const cacheKey = createCacheKey("label-ocr", {
    model: ocrModel,
    image: labelImage.storageKey || labelImage.url
  });
  const cached = await aiCache.get<{
    ok: boolean;
    status: "not_provided" | "completed" | "partial" | "failed";
    extraction?: DedicatedLabelExtraction;
    warnings: string[];
  }>(cacheKey);
  if (cached) {
    logAiEvent({ operation: "label-ocr", model: ocrModel, latencyMs: 0, status: "success", cacheHit: true });
    return cached;
  }

  const startedAt = Date.now();
  try {
    const response = await openai.responses.create({
      model: ocrModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildLabelExtractionPrompt() },
            { type: "input_image", image_url: labelImage.url, detail: "high" }
          ]
        }
      ]
    });

    const json = safeParseJson(response.output_text || "{}");
    if (!json.ok) throw new Error(json.reason);
    const validated = validateJsonResponse(labelExtractionSchema, json.data);
    if (!validated.ok) throw new Error(validated.reason);
    const extraction = {
      ...validated.data,
      rawLabelText: {
        ...validated.data.rawLabelText,
        value: validated.data.rawLabelText.value ? sanitizeExtractedText(validated.data.rawLabelText.value) : null
      }
    };
    const fieldConfidences = [
      extraction.rawLabelText.confidence,
      extraction.size.confidence,
      extraction.brand.confidence,
      extraction.fabricComposition.confidence,
      extraction.careInstructions.confidence,
      extraction.countryOfOrigin.confidence
    ];
    const hasUsefulField = fieldConfidences.some((confidence) => confidence >= 0.5);
    const status: "completed" | "partial" = hasUsefulField && !extraction.warnings.length ? "completed" : "partial";

    const result = {
      ok: true,
      status,
      extraction,
      warnings: extraction.warnings
    };
    await aiCache.set(cacheKey, result, 60 * 60);
    logAiEvent({ operation: "label-ocr", model: ocrModel, latencyMs: Date.now() - startedAt, status: "success", cacheHit: false });
    return result;
  } catch (error) {
    logAiEvent({ operation: "label-ocr", model: ocrModel, latencyMs: Date.now() - startedAt, status: "failed", errorCategory: errorCategory(error) });
    return {
      ok: false,
      status: "failed",
      warnings: [safeAIError("Label extraction failed.")]
    };
  }
}
