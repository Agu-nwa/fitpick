export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/audit";
import { askStylist } from "@/lib/ai/stylist";
import { buildRecentConversationContext, buildStylistContext } from "@/lib/ai/context/stylist-context";
import { sanitizeUserPrompt } from "@/lib/ai/safety/ai-safety";
import { buildRecommendation } from "@/lib/recommendation/engine";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { logSafeError } from "@/lib/security/safe-log";
import { getOrCreateStyleProfile, serializeStyleProfile } from "@/lib/style-profile/style-profile";
import { getMemorySummary, serializeMemorySummary } from "@/lib/fashion-memory/fashion-memory";
import {
  createOrReuseStylistOutfitRecommendation,
  serializeStylistVisualization,
  shouldGenerateVisualization,
  triggerDigitalHumanPreviewForStylist
} from "@/lib/stylist/stylist-visualization";
import { WardrobeItem } from "@/models/WardrobeItem";

const stylistChatSchema = z.object({
  message: z.string().trim().min(1).max(800),
  allowShoppingAdvice: z.boolean().default(false),
  includeVisualization: z.boolean().optional(),
  visualMode: z.enum(["digital_human", "premium_preview", "none"]).optional(),
  recentMessages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]).optional(),
        content: z.string().trim().max(800).optional()
      })
    )
    .max(8)
    .optional()
});

function compactRecommendationForStylist(recommendation: any) {
  return {
    title: recommendation.title,
    occasion: recommendation.occasion,
    confidence: recommendation.confidence,
    confidenceScore: recommendation.confidenceScore || 0,
    summary: recommendation.summary,
    occasionFit: recommendation.occasionFit,
    whyItWorks: recommendation.whyItWorks,
    improvementNote: recommendation.improvementNote,
    addLater: recommendation.addLater,
    stylingTips: recommendation.stylingTips || [],
    items: (recommendation.items || []).map((item: any) => ({
      id: String(item._id),
      name: item.name,
      category: item.category,
      color: item.color,
      fabric: item.fabric,
      fit: item.fit
    }))
  };
}

export async function POST(request: NextRequest) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `stylist-chat:${meta.ip}`, limit: 30, windowMs: 60 * 1000, operation: "stylist-chat" });
  if (limited) return limited;

  try {
    const auth = await requireUser();

    if (!auth.ok) {
      return auth.response;
    }

    const parsed = stylistChatSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("BAD_REQUEST", "Message is required.");

    const [wardrobe, styleProfile, memorySummary] = await Promise.all([
      WardrobeItem.find({
        userId: auth.user._id,
        archivedAt: null
      }).lean(),
      getOrCreateStyleProfile(auth.user._id),
      getMemorySummary(auth.user._id)
    ]);

    const serializedStyleProfile = serializeStyleProfile(styleProfile);
    const serializedMemorySummary = serializeMemorySummary(memorySummary);
    const stylistContext = buildStylistContext(wardrobe, serializedStyleProfile, serializedMemorySummary);
    const recentMessages = buildRecentConversationContext(parsed.data.recentMessages || []);
    const sanitizedMessage = sanitizeUserPrompt(parsed.data.message);
    const deterministicRecommendation = buildRecommendation({
      occasionName: sanitizedMessage,
      weatherContext: "",
      preferences: {},
      styleProfile: serializedStyleProfile,
      memorySummary: serializedMemorySummary,
      wardrobeItems: wardrobe,
      wornLooks: []
    });
    const stylistRecommendation = compactRecommendationForStylist(deterministicRecommendation);
    const wardrobeSummary = wardrobe
      .slice(0, 50)
      .map(
        (item: any) => {
          const verified = item.verifiedMetadata || {};
          const verifiedLine = Object.entries(verified)
            .slice(0, 10)
            .map(([key, field]: [string, any]) => `${key}:${Array.isArray(field?.value) ? field.value.join(",") : field?.value || "unknown"}`)
            .join(" | ");

          return [
            `id:${String(item._id)}`,
            `name:${item.name || "unnamed"}`,
            `category:${item.category || "unknown"}`,
            `color:${item.color || "unknown"}`,
            `subcategory:${item.subcategory || "unknown"}`,
            `fabric:${item.fabric || "unknown"}`,
            `pattern:${item.pattern || "unknown"}`,
            `occasions:${(item.occasions || []).join(",") || "unknown"}`,
            `weather:${(item.weather || []).join(",") || "unknown"}`,
            verifiedLine ? `verified:${verifiedLine}` : ""
          ].filter(Boolean).join(" | ");
        }
      )
      .join("\n");

    const response = await askStylist({
      message: sanitizedMessage,
      wardrobeSummary,
      wardrobeContext: stylistContext.wardrobe,
      styleProfile: stylistContext.styleProfile,
      memorySummary: stylistContext.memorySummary,
      fallback: stylistContext.fallback,
      allowShoppingAdvice: parsed.data.allowShoppingAdvice,
      ownedItemIds: stylistContext.ownedItemIds,
      recentMessages,
      deterministicRecommendation: stylistRecommendation
    });

    let visualization = serializeStylistVisualization();
    let persistedOutfit: Awaited<ReturnType<typeof createOrReuseStylistOutfitRecommendation>> = null;
    const visualMode = parsed.data.visualMode || "digital_human";
    const hasOutfit = Boolean(deterministicRecommendation.items?.length);
    const wantsVisualization = shouldGenerateVisualization(response.stylist.intent, sanitizedMessage, {
      includeVisualization: parsed.data.includeVisualization,
      visualMode,
      hasOutfit
    });

    if (wantsVisualization) {
      const visualizationLimited = rateLimitPlaceholder({
        key: `stylist-visualization:${String(auth.user._id)}`,
        limit: 6,
        windowMs: 60 * 1000,
        operation: "stylist-visualization"
      });

      if (visualizationLimited) {
        visualization = serializeStylistVisualization({
          visualMode,
          avatarPreview: {
            status: "failed",
            jobId: null,
            previewId: null,
            imageUrl: null,
            cacheKey: null,
            errorMessage: "Digital Human generation is busy right now. Please try again shortly."
          }
        });
      } else {
        try {
          persistedOutfit = await createOrReuseStylistOutfitRecommendation(
            String(auth.user._id),
            deterministicRecommendation,
            {
              ownedItemIds: stylistContext.ownedItemIds,
              requestText: sanitizedMessage,
              source: "stylist_chat"
            }
          );

          visualization = persistedOutfit
            ? await triggerDigitalHumanPreviewForStylist(String(auth.user._id), persistedOutfit.outfitRecommendationId, { visualMode })
            : serializeStylistVisualization({
                visualMode,
                avatarPreview: {
                  status: "not_started",
                  jobId: null,
                  previewId: null,
                  imageUrl: null,
                  cacheKey: null,
                  errorMessage: "FitPick could not assemble a complete owned outfit to visualize."
                }
              });
        } catch (error) {
          logSafeError("stylist.visualization", error);
          visualization = serializeStylistVisualization({
            visualMode,
            outfitRecommendationId: persistedOutfit?.outfitRecommendationId || null,
            avatarPreview: {
              status: "failed",
              jobId: null,
              previewId: null,
              imageUrl: null,
              cacheKey: null,
              errorMessage: "Unable to create the Digital Human look right now."
            }
          });
        }
      }
    }

    const stylist = {
      ...response.stylist,
      visualMode: visualization.visualMode,
      outfitRecommendationId: visualization.outfitRecommendationId,
      avatarPreview: visualization.avatarPreview,
      visualizationDisclaimer: visualization.visualizationDisclaimer
    };

    return apiSuccess({
      reply: response.reply,
      stylist,
      outfitRecommendationId: visualization.outfitRecommendationId,
      avatarPreview: visualization.avatarPreview,
      visualization,
      outfit: persistedOutfit?.serializedOutfit || null,
      job: visualization.job,
      groundedItemCount: wardrobe.length
    });
  } catch (error) {
    logSafeError("stylist.chat", error);

    return apiError(
      "INTERNAL_ERROR",
      "Unable to contact stylist."
    );
  }
}
