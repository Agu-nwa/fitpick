import { openai } from "@/lib/ai/openai";
import { extractLabelMetadata, type DedicatedLabelExtraction } from "@/lib/ai/ocr-label-extraction";
import { aiCache, createCacheKey } from "@/lib/ai/cache/ai-cache";
import { getAiModel } from "@/lib/ai/models/registry";
import { errorCategory, logAiEvent } from "@/lib/ai/observability/ai-logger";
import { buildWardrobeAnalysisPrompt } from "@/lib/ai/prompts";
import { safeAIError } from "@/lib/ai/safety/ai-safety";
import { wardrobeAiAnalysisSchema, type WardrobeAiAnalysis } from "@/lib/ai/schemas/wardrobe-ai.schema";
import { safeParseJson, validateJsonResponse } from "@/lib/ai/validation/response-validator";
import { resolveGarmentEntity, serializeEntityRecognition } from "@/lib/garment-intelligence/entity-resolver";
import type { AiSuggestedWardrobeTags, AiTaggingInput, AiTaggingResult } from "@/types/ai-tagging";

function averageConfidence(analysis: WardrobeAiAnalysis) {
  const fields = Object.values(analysis.fields);
  if (!fields.length) return 0;
  return fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length;
}

function withReviewWarning(analysis: WardrobeAiAnalysis, warning: string) {
  if (analysis.labelWarnings.includes(warning)) return analysis;
  return {
    ...analysis,
    labelWarnings: [...analysis.labelWarnings, warning].slice(0, 10)
  };
}

function mergeTextField<T extends "size" | "brand" | "fabricComposition" | "rawLabelText" | "countryOfOrigin">(
  analysis: WardrobeAiAnalysis,
  field: T,
  ocr: DedicatedLabelExtraction[T]
) {
  const current = analysis.fields[field];
  if (!ocr.value || ocr.confidence <= current.confidence) {
    return ocr.confidence > 0 && ocr.confidence < 0.65
      ? withReviewWarning(analysis, `${field} label confidence is low; user review required.`)
      : analysis;
  }

  return {
    ...analysis,
    fields: {
      ...analysis.fields,
      [field]: ocr
    }
  };
}

function mergeCareInstructions(analysis: WardrobeAiAnalysis, ocr: DedicatedLabelExtraction["careInstructions"]) {
  const current = analysis.fields.careInstructions;
  if (!ocr.value.length || ocr.confidence <= current.confidence) {
    return ocr.confidence > 0 && ocr.confidence < 0.65
      ? withReviewWarning(analysis, "careInstructions label confidence is low; user review required.")
      : analysis;
  }

  return {
    ...analysis,
    fields: {
      ...analysis.fields,
      careInstructions: ocr
    }
  };
}

function mergeLabelExtraction(analysis: WardrobeAiAnalysis, extraction?: DedicatedLabelExtraction) {
  if (!extraction) return analysis;

  let merged = analysis;
  merged = mergeTextField(merged, "rawLabelText", extraction.rawLabelText);
  merged = mergeTextField(merged, "size", extraction.size);
  merged = mergeTextField(merged, "brand", extraction.brand);
  merged = mergeTextField(merged, "fabricComposition", extraction.fabricComposition);
  merged = mergeTextField(merged, "countryOfOrigin", extraction.countryOfOrigin);
  merged = mergeCareInstructions(merged, extraction.careInstructions);

  return {
    ...merged,
    labelWarnings: [...merged.labelWarnings, ...extraction.warnings].slice(0, 10)
  };
}

function mergeEntityRecognition(analysis: WardrobeAiAnalysis, extraction?: DedicatedLabelExtraction) {
  try {
    const resolved = serializeEntityRecognition(resolveGarmentEntity(analysis, extraction));
    const fields = { ...analysis.fields } as any;

    for (const [key, resolvedField] of Object.entries(resolved)) {
      const current = fields[key];
      if (Array.isArray((resolvedField as any).value)) {
        const mergedValues = Array.from(new Set([...(current?.value || []), ...((resolvedField as any).value || [])])).slice(0, 20);
        fields[key] = {
          ...resolvedField,
          value: mergedValues,
          confidence: Math.max(current?.confidence || 0, (resolvedField as any).confidence || 0)
        };
        continue;
      }

      if ((resolvedField as any).value !== null && ((resolvedField as any).confidence || 0) >= (current?.confidence || 0)) {
        fields[key] = resolvedField;
      }
    }

    const entityWarnings = (fields.entityWarnings?.value || []) as string[];
    return {
      ...analysis,
      fields,
      labelWarnings: [...analysis.labelWarnings, ...entityWarnings].slice(0, 10)
    };
  } catch {
    return withReviewWarning(analysis, "Advanced garment recognition is unavailable; please verify manually.");
  }
}

export function analysisToSuggestedTags(analysis: WardrobeAiAnalysis): AiSuggestedWardrobeTags {
  const fields = analysis.fields;
  const confidence = averageConfidence(analysis);
  const entityName = fields.recognizedEntity.value && fields.recognizedEntity.confidence >= 0.65
    ? fields.recognizedEntity.value
    : "";

  return {
    name: entityName || [fields.primaryColor.value, fields.garmentType.value].filter(Boolean).join(" ").trim() || undefined,
    category: fields.category.value || undefined,
    subcategory: fields.subcategory.value || fields.garmentType.value || (fields.sportCategory.value ? "jersey" : ""),
    color: fields.primaryColor.value || "",
    pattern: fields.pattern.value || "",
    fabric: fields.fabricComposition.value || fields.fabricEstimate.value || "",
    fit: fields.fit.value || "",
    formality: fields.formalityScore.value ? [fields.formalityScore.value] : [],
    occasions: fields.occasionSuitability.value,
    weather: fields.weatherSuitability.value,
    taggedSize: fields.taggedSize.value || "unknown",
    sizeSystem: fields.sizeSystem.value || "unknown",
    garmentFit: fields.garmentFit.value || "unknown",
    stretchLevel: fields.stretchLevel.value || "unknown",
    fabricDrape: fields.fabricDrape.value || "unknown",
    fitConfidence: fields.fitConfidence.value ?? fields.fit.confidence ?? 0,
    measurementSource: fields.measurementSource.value || (fields.size.source === "ocr" ? "label_ocr" : "ai_estimated"),
    confidence,
    needsReview: true
  };
}

export async function analyzeWardrobeImages(input: AiTaggingInput): Promise<AiTaggingResult> {
  const model = getAiModel("wardrobeVision");
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      provider: "openai",
      aiTagStatus: "failed",
      safeMessage: "OpenAI API key is missing."
    };
  }

  const imageEntries = [
    { label: "front view", url: input.imageUrl },
    ...(input.images?.front?.url ? [{ label: "front view", url: input.images.front.url }] : []),
    ...(input.images?.back?.url ? [{ label: "back view", url: input.images.back.url }] : []),
    ...(input.images?.fabricCloseUp?.url ? [{ label: "fabric close-up", url: input.images.fabricCloseUp.url }] : []),
    ...(input.images?.label?.url ? [{ label: "care and size label", url: input.images.label.url }] : [])
  ].filter((entry, index, all) => entry.url && all.findIndex((candidate) => candidate.url === entry.url) === index);

  if (!imageEntries.length) {
    return {
      ok: false,
      provider: "openai",
      aiTagStatus: "failed",
      safeMessage: "Upload image details are not available for analysis."
    };
  }

  const cacheKey = createCacheKey("wardrobe-analysis", {
    model,
    images: [
      input.storageKey,
      input.images?.front?.storageKey || input.images?.front?.url,
      input.images?.back?.storageKey || input.images?.back?.url,
      input.images?.fabricCloseUp?.storageKey || input.images?.fabricCloseUp?.url,
      input.images?.label?.storageKey || input.images?.label?.url
    ].filter(Boolean)
  });
  const cached = await aiCache.get<AiTaggingResult>(cacheKey);
  if (cached) {
    logAiEvent({ operation: "wardrobe-analysis", model, latencyMs: 0, status: "success", cacheHit: true });
    return cached;
  }

  const startedAt = Date.now();
  try {
    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildWardrobeAnalysisPrompt() },
            ...imageEntries.flatMap((entry) => [
              { type: "input_text" as const, text: `Image purpose: ${entry.label}` },
              { type: "input_image" as const, image_url: entry.url || "", detail: "auto" as const }
            ])
          ]
        }
      ]
    });

    const json = safeParseJson(response.output_text || "{}");
    if (!json.ok) throw new Error(json.reason);
    const validated = validateJsonResponse(wardrobeAiAnalysisSchema.partial({ provider: true, model: true, status: true }), json.data);
    if (!validated.ok) throw new Error(validated.reason);

    const visionAnalysis = wardrobeAiAnalysisSchema.parse({
      ...validated.data,
      provider: "openai",
      model,
      status: "suggested",
      labelExtractionStatus: input.images?.label?.url ? "pending" : "not_provided",
      labelWarnings: [],
      analyzedAt: new Date().toISOString()
    });

    const labelResult = await extractLabelMetadata(input.images?.label);
    const mergedAnalysis = mergeEntityRecognition(mergeLabelExtraction(visionAnalysis, labelResult.extraction), labelResult.extraction);
    const analysis = wardrobeAiAnalysisSchema.parse({
      ...mergedAnalysis,
      labelExtractionStatus: labelResult.status,
      labelWarnings: [...mergedAnalysis.labelWarnings, ...labelResult.warnings].slice(0, 10)
    });

    const suggestedTags = analysisToSuggestedTags(analysis);
    const result = {
      ok: true,
      provider: "openai",
      confidence: suggestedTags.confidence,
      aiTagStatus: suggestedTags.confidence >= 0.8 ? "completed" : "needs-review",
      suggestedTags,
      aiAnalysis: analysis
    } satisfies AiTaggingResult;
    await aiCache.set(cacheKey, result, 60 * 30);
    logAiEvent({ operation: "wardrobe-analysis", model, latencyMs: Date.now() - startedAt, status: "success", cacheHit: false });
    return result;
  } catch (error) {
    logAiEvent({ operation: "wardrobe-analysis", model, latencyMs: Date.now() - startedAt, status: "failed", errorCategory: errorCategory(error) });
    return {
      ok: false,
      provider: "openai",
      aiTagStatus: "failed",
      safeMessage: safeAIError(error)
    };
  }
}
