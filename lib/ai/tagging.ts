import { aiTaggingResultSchema, aiSuggestedWardrobeTagsSchema } from "@/schemas/ai-tagging.schema";
import { analyzeWardrobeImages } from "@/lib/ai/wardrobe-analysis";
import { suggestWithGeminiProvider } from "@/lib/ai/providers/gemini-tagging";
import { suggestWithMockProvider } from "@/lib/ai/providers/mock-tagging";
import type { AiSuggestedWardrobeTags, AiTaggingInput, AiTaggingProvider, AiTaggingResult } from "@/types/ai-tagging";
import { suggestWithOpenAiProvider } from "@/lib/ai/providers/openai-tagging";

const safeFailedResult: AiTaggingResult = {
  ok: false,
  provider: "mock",
  aiTagStatus: "failed",
  safeMessage: "We could not suggest tags for this item. You can add them manually."
};

export function getAiTaggingProvider(): AiTaggingProvider {
  const provider = process.env.AI_TAGGING_PROVIDER;
  if (provider === "gemini" || provider === "openai" || provider === "mock") return provider;
  return "mock";
}

export function normalizeSuggestedTags(result: AiTaggingResult): AiTaggingResult {
  if (!result.suggestedTags) return result;
  const confidence = Math.min(1, Math.max(0, result.suggestedTags.confidence ?? result.confidence ?? 0));
  return {
    ...result,
    confidence,
    aiTagStatus: confidence >= 0.8 ? "completed" : "needs-review",
    suggestedTags: {
      ...result.suggestedTags,
      confidence,
      needsReview: true
    }
  };
}

export function validateSuggestedTags(result: AiTaggingResult): AiTaggingResult {
  const parsed = aiTaggingResultSchema.safeParse(result);
  if (!parsed.success) return { ...safeFailedResult, provider: result.provider };
  if (!parsed.data.suggestedTags) return parsed.data;

  const tags = aiSuggestedWardrobeTagsSchema.safeParse(parsed.data.suggestedTags);
  if (!tags.success) return { ...safeFailedResult, provider: result.provider };
  return { ...parsed.data, suggestedTags: tags.data as AiSuggestedWardrobeTags };
}

export async function suggestWardrobeTags(input: AiTaggingInput): Promise<AiTaggingResult> {
  const provider = getAiTaggingProvider();
  try {
    const result =
      provider === "gemini"
          ? await suggestWithGeminiProvider(input)
          : provider === "openai"
            ? await analyzeWardrobeImages(input)
            : await suggestWithMockProvider(input);

    return validateSuggestedTags(normalizeSuggestedTags(result));
  } catch {
    return { ...safeFailedResult, provider };
  }
}
