import { aiCache, createCacheKey } from "@/lib/ai/cache/ai-cache";
import { openai } from "@/lib/ai/openai";
import { getAiModel } from "@/lib/ai/models/registry";
import { errorCategory, logAiEvent } from "@/lib/ai/observability/ai-logger";
import { buildStylistPrompt } from "@/lib/ai/prompts";
import { assertWardrobeGrounding, safeAIError, sanitizeUserPrompt } from "@/lib/ai/safety/ai-safety";
import { stylistResponseSchema, type StylistIntent, type StylistResponse } from "@/lib/ai/schemas/stylist.schema";
import { safeParseJson, validateJsonResponse } from "@/lib/ai/validation/response-validator";

function detectIntent(message: string, allowShoppingAdvice: boolean): StylistIntent {
  const text = message.toLowerCase();
  if (allowShoppingAdvice || /buy|shop|purchase|add later|what should i add/.test(text)) return "shopping_advice_requested";
  if (/compare|which is better/.test(text)) return "compare_outfits";
  if (/more casual|more formal|improve|change|swap/.test(text)) return "improve_outfit";
  if (/why|explain|work/.test(text)) return "explain_item";
  if (/pack|packing|travel|trip|vacation/.test(text)) return "packing_help";
  if (/missing|gap|need/.test(text)) return "wardrobe_gap";
  if (/wear|style me|outfit|church|wedding|date|owambe|aso-ebi|traditional|native|business|casual/.test(text)) return "outfit_request";
  if (text.length < 10) return "unclear";
  return "general_style_advice";
}

function uniqueOwnedIds(ids: string[] = [], ownedItemIds: string[]) {
  const owned = new Set(ownedItemIds.map(String));
  return Array.from(new Set(ids.map(String).filter((id) => owned.has(id))));
}

function fallbackStylistResponse(input: {
  message: string;
  intent: StylistIntent;
  ownedItemIds: string[];
  deterministicRecommendation?: any;
  allowShoppingAdvice: boolean;
  fallback?: string;
  safetyWarnings?: string[];
}): StylistResponse {
  const items = (input.deterministicRecommendation?.items || []) as any[];
  const recommendedItemIds = items.map((item) => String(item._id || item.id)).filter((id) => input.ownedItemIds.includes(id));
  const missing = input.deterministicRecommendation?.improvementNote?.match(/(?:owned|verify) (.+?) options/i)?.[1]?.split(/\s+and\s+|,\s*/) || [];
  const message = recommendedItemIds.length
    ? input.deterministicRecommendation?.whyItWorks || input.deterministicRecommendation?.summary || "I found a grounded outfit from your wardrobe."
    : input.fallback || "I need a little more wardrobe context before I can style this properly.";

  return {
    message,
    intent: input.intent,
    recommendedOutfitIds: [],
    recommendedItemIds,
    alternativeItemIds: [],
    missingWardrobeCategories: missing.filter(Boolean).slice(0, 5),
    occasionDetected: input.deterministicRecommendation?.occasion || null,
    confidenceScore: input.deterministicRecommendation?.confidenceScore || 0,
    stylingTips: input.deterministicRecommendation?.stylingTips || [],
    followUpQuestions: input.intent === "unclear" ? ["What occasion are you dressing for?"] : [],
    addLaterSuggestions: input.allowShoppingAdvice && input.deterministicRecommendation?.addLater ? [input.deterministicRecommendation.addLater] : [],
    safetyWarnings: input.safetyWarnings || []
  };
}

function groundStylistResponse(response: StylistResponse, ownedItemIds: string[], allowShoppingAdvice: boolean) {
  const safetyWarnings = [...response.safetyWarnings];
  if (!assertWardrobeGrounding(response.recommendedItemIds, ownedItemIds) || !assertWardrobeGrounding(response.alternativeItemIds, ownedItemIds)) {
    safetyWarnings.push("Removed unowned wardrobe references from stylist response.");
  }

  return {
    ...response,
    recommendedItemIds: uniqueOwnedIds(response.recommendedItemIds, ownedItemIds),
    alternativeItemIds: uniqueOwnedIds(response.alternativeItemIds, ownedItemIds),
    addLaterSuggestions: allowShoppingAdvice ? response.addLaterSuggestions : [],
    safetyWarnings
  };
}

export async function askStylist({
  message,
  wardrobeSummary,
  wardrobeContext,
  styleProfile,
  memorySummary,
  fallback,
  allowShoppingAdvice = false,
  ownedItemIds = [],
  recentMessages = [],
  deterministicRecommendation
}: {
  message: string;
  wardrobeSummary: string;
  wardrobeContext?: unknown;
  styleProfile?: unknown;
  memorySummary?: unknown;
  fallback?: string;
  allowShoppingAdvice?: boolean;
  ownedItemIds?: string[];
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  deterministicRecommendation?: unknown;
}) {
  const model = getAiModel("stylistChat");
  const sanitizedMessage = sanitizeUserPrompt(message);
  const intent = detectIntent(sanitizedMessage, allowShoppingAdvice);
  const fallbackResponse = fallbackStylistResponse({
    message: sanitizedMessage,
    intent,
    ownedItemIds,
    deterministicRecommendation,
    allowShoppingAdvice,
    fallback
  });

  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      reply: fallbackResponse.message,
      stylist: fallbackResponse
    };
  }

  const cacheKey = createCacheKey("stylist-chat", {
    model,
    message: sanitizedMessage,
    allowShoppingAdvice,
    ownedItemIds,
    styleProfile,
    memorySummary,
    deterministicItemIds: (deterministicRecommendation as any)?.items?.map((item: any) => String(item._id || item.id)) || []
  });
  const cached = await aiCache.get<StylistResponse>(cacheKey);
  if (cached) {
    logAiEvent({ operation: "stylist-chat", model, latencyMs: 0, status: "success", cacheHit: true });
    return { ok: true, reply: cached.message, stylist: cached };
  }

  const startedAt = Date.now();
  try {
    const response = await openai.responses.create({
      model,
      input: buildStylistPrompt({
        wardrobeContext: wardrobeContext || wardrobeSummary,
        styleProfile,
        memorySummary,
        userMessage: sanitizedMessage,
        allowShoppingAdvice,
        fallback,
        recentMessages,
        deterministicRecommendation
      })
    });

    const json = safeParseJson(response.output_text || "{}");
    if (!json.ok) throw new Error(json.reason);
    const validated = validateJsonResponse(stylistResponseSchema, json.data);
    if (!validated.ok) throw new Error(validated.reason);
    const grounded = groundStylistResponse(validated.data, ownedItemIds, allowShoppingAdvice);

    await aiCache.set(cacheKey, grounded, 60 * 10);
    logAiEvent({ operation: "stylist-chat", model, latencyMs: Date.now() - startedAt, status: "success", cacheHit: false });
    return {
      ok: true,
      reply: grounded.message,
      stylist: grounded
    };
  } catch (error) {
    logAiEvent({ operation: "stylist-chat", model, latencyMs: Date.now() - startedAt, status: "failed", errorCategory: errorCategory(error) });
    const safe = fallbackStylistResponse({
      message: sanitizedMessage,
      intent,
      ownedItemIds,
      deterministicRecommendation,
      allowShoppingAdvice,
      fallback,
      safetyWarnings: [safeAIError(error)]
    });
    return {
      ok: false,
      reply: safe.message,
      stylist: safe
    };
  }
}
