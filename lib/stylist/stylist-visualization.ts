import crypto from "crypto";
import { getAiModel } from "@/lib/ai/models/registry";
import type { StylistIntent, StylistVisualMode } from "@/lib/ai/schemas/stylist.schema";
import {
  avatarPreviewPromptVersion,
  buildAvatarCacheKeyFromItems,
  generateAvatarOutfitPreview,
  getCachedAvatarPreview,
  loadOwnedAvatarPreviewSubject,
  markAvatarPreviewStatus,
  saveAvatarPreview,
  serializeAvatarPreview
} from "@/lib/avatar/avatar-preview";
import type { PosePreset, VisualizationStyle } from "@/lib/avatar/avatar-profile";
import { evaluateOutfitFitOnAvatar, type FitEvaluation } from "@/lib/fit/fit-lock";
import { backgroundJobsEnabled, enqueueJob, serializeJob } from "@/lib/jobs/queue";
import {
  buildPreviewCacheKeyFromItems,
  generateOutfitPreview as generatePremiumOutfitPreview,
  getCachedOutfitPreview,
  loadOwnedPreviewSubject,
  previewPromptVersion,
  saveGeneratedPreview,
  serializeOutfitPreview
} from "@/lib/outfit-preview/outfit-preview";
import { serializeOutfit } from "@/lib/recommendation/engine";
import { AvatarOutfitPreview } from "@/models/AvatarOutfitPreview";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { OutfitPreview } from "@/models/OutfitPreview";

export const stylistVisualizationDisclaimer = "AI visualization, not exact virtual try-on.";

export type StylistVisualizationOptions = {
  includeVisualization?: boolean;
  visualMode?: StylistVisualMode;
  hasOutfit?: boolean;
  regenerate?: boolean;
  visualizationStyle?: VisualizationStyle;
  posePreset?: PosePreset;
};

type AvatarPreviewSummary = {
  status: "not_started" | "queued" | "generating" | "ready" | "failed";
  jobId: string | null;
  previewId: string | null;
  imageUrl: string | null;
  cacheKey: string | null;
  errorMessage: string | null;
  accuracyLevel?: FitEvaluation["accuracyLevel"];
  fitStatus?: string;
  fitConfidence?: number;
  fitWarnings?: string[];
};

export type StylistVisualizationResult = {
  visualMode: StylistVisualMode;
  outfitRecommendationId: string | null;
  avatarPreview: AvatarPreviewSummary;
  visualizationDisclaimer: string;
  fitLock?: {
    fitStatus: string;
    fitConfidence: number;
    warnings: string[];
    lockedFitInstructions: string[];
    accuracyLevel: FitEvaluation["accuracyLevel"];
  };
  job?: ReturnType<typeof serializeJob>;
};

type PersistedStylistOutfit = {
  outfit: any;
  items: any[];
  outfitRecommendationId: string;
  serializedOutfit: ReturnType<typeof serializeOutfit>;
};

type StylistVisualizationSerializeInput = Omit<Partial<StylistVisualizationResult>, "job"> & {
  job?: any;
};

function defaultAvatarPreview(patch: Partial<AvatarPreviewSummary> = {}): AvatarPreviewSummary {
  return {
    status: "not_started",
    jobId: null,
    previewId: null,
    imageUrl: null,
    cacheKey: null,
    errorMessage: null,
    ...patch
  };
}

function fitLockSummary(fitEvaluation?: FitEvaluation) {
  if (!fitEvaluation) return undefined;
  return {
    fitStatus: fitEvaluation.fitStatus,
    fitConfidence: fitEvaluation.fitConfidence,
    warnings: fitEvaluation.warnings,
    lockedFitInstructions: fitEvaluation.lockedFitInstructions,
    accuracyLevel: fitEvaluation.accuracyLevel
  };
}

function previewFitPatch(fitEvaluation?: FitEvaluation): Partial<AvatarPreviewSummary> {
  if (!fitEvaluation) return {};
  return {
    accuracyLevel: fitEvaluation.accuracyLevel,
    fitStatus: fitEvaluation.fitStatus,
    fitConfidence: fitEvaluation.fitConfidence,
    fitWarnings: fitEvaluation.warnings
  };
}

function cleanText(value: unknown, max = 220) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function itemId(item: any) {
  return String(item?._id || item?.id || "");
}

function reuseKeyFor(userId: string, itemIds: string[], occasion: string) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      userId,
      itemIds: itemIds.map(String).sort(),
      occasion: cleanText(occasion, 80).toLowerCase()
    }))
    .digest("hex")
    .slice(0, 64);
}

async function markPremiumPreviewStatus(
  userId: string,
  outfitId: string,
  cacheKey: string,
  patch: Record<string, unknown>,
  incrementAttempt = false
) {
  const update: Record<string, unknown> = { $set: patch };
  if (incrementAttempt) update.$inc = { attempts: 1 };

  const preview = await OutfitPreview.findOneAndUpdate(
    { userId, outfitId, cacheKey },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const outfitUpdate: Record<string, unknown> = {
    $set: Object.fromEntries(Object.entries(patch).map(([key, value]) => [`preview.${key}`, value]))
  };
  if (incrementAttempt) outfitUpdate.$inc = { "preview.attempts": 1 };
  await OutfitRecommendation.findOneAndUpdate({ _id: outfitId, userId }, outfitUpdate);

  return preview;
}

export function shouldGenerateVisualization(
  intent: StylistIntent,
  userMessage: string,
  options: StylistVisualizationOptions = {}
) {
  if (options.includeVisualization === false || options.visualMode === "none") return false;
  if (!options.hasOutfit) return false;

  const allowedIntent =
    intent === "outfit_request" ||
    intent === "improve_outfit" ||
    intent === "packing_help";

  if (intent === "shopping_advice_requested" || intent === "general_style_advice" || intent === "wardrobe_gap" || intent === "unclear") {
    return false;
  }

  const text = userMessage.toLowerCase();
  const stylingText = /(style me|what should i wear|build|look|outfit|wear|church|wedding|date|business casual|traditional|native|owambe|aso-ebi|vacation)/.test(text);
  return allowedIntent || (options.includeVisualization === true && stylingText);
}

export async function createOrReuseStylistOutfitRecommendation(
  userId: string,
  recommendationResult: any,
  stylistContext: {
    ownedItemIds?: string[];
    requestText?: string;
    source?: "stylist_chat" | "system";
  } = {}
): Promise<PersistedStylistOutfit | null> {
  const owned = new Set((stylistContext.ownedItemIds || []).map(String));
  const items = (recommendationResult?.items || [])
    .filter((item: any) => {
      const id = itemId(item);
      return id && (!owned.size || owned.has(id));
    });

  const itemIds: string[] = Array.from(new Set<string>(items.map(itemId).filter(Boolean)));
  if (!itemIds.length) return null;

  const occasion = cleanText(recommendationResult?.occasion || "Today", 80) || "Today";
  const reuseKey = reuseKeyFor(userId, itemIds, occasion);
  const requestText = cleanText(stylistContext.requestText, 220);
  const source = stylistContext.source || "stylist_chat";

  const outfit = await OutfitRecommendation.findOneAndUpdate(
    { userId, source, reuseKey },
    {
      $setOnInsert: {
        userId,
        title: cleanText(recommendationResult?.title || `${occasion} outfit`, 120),
        occasion,
        itemIds,
        confidence: recommendationResult?.confidence || "Needs review",
        reasonChips: recommendationResult?.reasonChips || [],
        summary: cleanText(recommendationResult?.summary || "", 900),
        weatherContext: cleanText(recommendationResult?.weatherContext || "", 160),
        repetitionNote: cleanText(recommendationResult?.repetitionNote || "", 260),
        careNote: cleanText(recommendationResult?.careNote || "", 260),
        colorNote: cleanText(recommendationResult?.colorNote || "", 260),
        occasionFit: cleanText(recommendationResult?.occasionFit || "", 360),
        whyItWorks: cleanText(recommendationResult?.whyItWorks || "", 500),
        materialNote: cleanText(recommendationResult?.materialNote || "", 360),
        silhouetteNote: cleanText(recommendationResult?.silhouetteNote || "", 360),
        improvementNote: cleanText(recommendationResult?.improvementNote || "", 360),
        addLater: cleanText(recommendationResult?.addLater || "", 240),
        stylingTips: Array.isArray(recommendationResult?.stylingTips)
          ? recommendationResult.stylingTips.map((tip: unknown) => cleanText(tip, 180)).filter(Boolean).slice(0, 8)
          : [],
        confidenceScore: Math.max(0, Math.min(1, Number(recommendationResult?.confidenceScore || 0))),
        swapGroups: recommendationResult?.swapGroups || [],
        source,
        requestText,
        reuseKey,
        reasoningMetadata: {
          generatedBy: "stylist_visualization_orchestrator",
          visualSource: "stylist_chat",
          deterministicConfidence: recommendationResult?.confidenceScore || 0,
          itemCount: itemIds.length
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    outfit,
    items,
    outfitRecommendationId: String(outfit._id),
    serializedOutfit: serializeOutfit(outfit, items)
  };
}

async function triggerPremiumPreviewForStylist(
  userId: string,
  outfitRecommendationId: string,
  options: StylistVisualizationOptions = {}
): Promise<StylistVisualizationResult> {
  const visualMode: StylistVisualMode = "premium_preview";

  if (!process.env.OPENAI_API_KEY) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "failed",
        errorMessage: "Premium image generation is not configured yet."
      })
    });
  }

  const loaded = await loadOwnedPreviewSubject(userId, outfitRecommendationId);
  if (!loaded || loaded.missingItems) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "failed",
        errorMessage: "This premium preview needs all selected owned wardrobe items available."
      })
    });
  }

  const previewOptions = { style: "luxury_lookbook" as const };
  const cacheKey = buildPreviewCacheKeyFromItems(userId, outfitRecommendationId, loaded.items, previewOptions);
  const cached = options.regenerate ? null : await getCachedOutfitPreview(userId, outfitRecommendationId, cacheKey) as any;

  if (cached?.imageUrl) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "ready",
        previewId: String(cached._id),
        imageUrl: cached.imageUrl,
        cacheKey
      })
    });
  }

  const inFlight = await OutfitPreview.findOne({
    userId,
    outfitId: outfitRecommendationId,
    cacheKey,
    status: "generating",
    lastAttemptAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
  }).lean() as any;

  if (inFlight && !options.regenerate) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "generating",
        previewId: String(inFlight._id),
        imageUrl: inFlight.imageUrl || null,
        cacheKey
      })
    });
  }

  const previewRecord = await markPremiumPreviewStatus(
    userId,
    outfitRecommendationId,
    cacheKey,
    {
      userId,
      outfitId: loaded.outfit._id,
      cacheKey,
      status: "generating",
      provider: "s3",
      promptVersion: previewPromptVersion,
      model: getAiModel("imageGeneration"),
      errorMessage: "",
      lastAttemptAt: new Date()
    },
    true
  );

  if (backgroundJobsEnabled()) {
    const job = await enqueueJob(
      "outfit_preview_generation",
      {
        outfitId: outfitRecommendationId,
        style: previewOptions.style,
        cacheKey,
        source: "stylist_chat",
        visualMode
      },
      {
        userId,
        maxAttempts: 3
      }
    );

    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "queued",
        jobId: String(job._id),
        previewId: previewRecord?._id ? String(previewRecord._id) : null,
        cacheKey
      }),
      job
    });
  }

  try {
    const generated = await generatePremiumOutfitPreview(userId, loaded.outfit, loaded.items, previewOptions);
    const saved = await saveGeneratedPreview(userId, outfitRecommendationId, generated, cacheKey);
    const preview = serializeOutfitPreview(saved);

    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "ready",
        previewId: preview.id || null,
        imageUrl: preview.imageUrl || preview.previewUrl || null,
        cacheKey
      })
    });
  } catch {
    await markPremiumPreviewStatus(
      userId,
      outfitRecommendationId,
      cacheKey,
      {
        status: "failed",
        errorMessage: "Unable to generate premium preview right now.",
        lastAttemptAt: new Date()
      }
    );

    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "failed",
        previewId: previewRecord?._id ? String(previewRecord._id) : null,
        cacheKey,
        errorMessage: "Unable to generate premium preview right now."
      })
    });
  }
}

export async function triggerDigitalHumanPreviewForStylist(
  userId: string,
  outfitRecommendationId: string,
  options: StylistVisualizationOptions = {}
): Promise<StylistVisualizationResult> {
  const visualMode: StylistVisualMode = options.visualMode || "digital_human";
  if (visualMode === "premium_preview") {
    return triggerPremiumPreviewForStylist(userId, outfitRecommendationId, options);
  }

  if (visualMode !== "digital_human") {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview()
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "failed",
        errorMessage: "Digital Human image generation is not configured yet."
      })
    });
  }

  const loaded = await loadOwnedAvatarPreviewSubject(userId, outfitRecommendationId);
  if (!loaded || loaded.missingItems) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "failed",
        errorMessage: "This Digital Human look needs all selected owned wardrobe items available."
      })
    });
  }

  if (!loaded.avatarProfile.consentAccepted) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        errorMessage: "Please review and save your Digital Human settings before generating an avatar look."
      })
    });
  }

  const fitEvaluation = evaluateOutfitFitOnAvatar(loaded.avatarProfile, loaded.items);
  const previewOptions = {
    visualizationStyle: options.visualizationStyle || loaded.avatarProfile.visualizationStyle || "luxury",
    posePreset: options.posePreset || loaded.avatarProfile.posePreset || "standing"
  };
  const cacheKey = buildAvatarCacheKeyFromItems(userId, outfitRecommendationId, loaded.items, loaded.avatarProfile, previewOptions);
  const cached = options.regenerate ? null : await getCachedAvatarPreview(userId, outfitRecommendationId, cacheKey) as any;

  if (cached?.imageUrl) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "ready",
        previewId: String(cached._id),
        imageUrl: cached.imageUrl,
        cacheKey,
        ...previewFitPatch(fitEvaluation)
      }),
      fitLock: fitLockSummary(fitEvaluation)
    });
  }

  const inFlight = await AvatarOutfitPreview.findOne({
    userId,
    outfitId: outfitRecommendationId,
    cacheKey,
    status: "generating",
    lastAttemptAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
  }).lean() as any;

  if (inFlight && !options.regenerate) {
    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "generating",
        previewId: String(inFlight._id),
        imageUrl: inFlight.imageUrl || null,
        cacheKey,
        ...previewFitPatch(fitEvaluation)
      }),
      fitLock: fitLockSummary(fitEvaluation)
    });
  }

  const previewRecord = await markAvatarPreviewStatus(
    userId,
    outfitRecommendationId,
    String(loaded.avatarProfile._id),
    cacheKey,
    {
      userId,
      outfitId: loaded.outfit._id,
      avatarProfileId: loaded.avatarProfile._id,
      itemIds: loaded.itemIds,
      cacheKey,
      status: "generating",
      provider: "s3",
      promptVersion: avatarPreviewPromptVersion,
      model: getAiModel("imageGeneration"),
      visualizationStyle: previewOptions.visualizationStyle,
      posePreset: previewOptions.posePreset,
      accuracyLevel: fitEvaluation.accuracyLevel.id,
      fitStatus: fitEvaluation.fitStatus,
      fitConfidence: fitEvaluation.fitConfidence,
      fitWarnings: fitEvaluation.warnings,
      fitLockInstructions: fitEvaluation.lockedFitInstructions,
      errorMessage: "",
      lastAttemptAt: new Date()
    },
    true
  );

  if (backgroundJobsEnabled()) {
    const job = await enqueueJob(
      "avatar_preview_generation",
      {
        outfitId: outfitRecommendationId,
        avatarProfileId: String(loaded.avatarProfile._id),
        visualizationStyle: previewOptions.visualizationStyle,
        posePreset: previewOptions.posePreset,
        cacheKey,
        source: "stylist_chat",
        visualMode
      },
      {
        userId,
        maxAttempts: 3
      }
    );

    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "queued",
        jobId: String(job._id),
        previewId: previewRecord?._id ? String(previewRecord._id) : null,
        cacheKey,
        ...previewFitPatch(fitEvaluation)
      }),
      fitLock: fitLockSummary(fitEvaluation),
      job
    });
  }

  try {
    const generated = await generateAvatarOutfitPreview(userId, loaded.outfit, loaded.items, loaded.avatarProfile, { ...previewOptions, cacheKey });
    const saved = await saveAvatarPreview(userId, outfitRecommendationId, String(loaded.avatarProfile._id), generated, loaded.itemIds, cacheKey);
    const preview = serializeAvatarPreview(saved);

    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "ready",
        previewId: preview.id || null,
        imageUrl: preview.imageUrl || preview.previewUrl || null,
        cacheKey,
        ...previewFitPatch(fitEvaluation)
      }),
      fitLock: fitLockSummary(fitEvaluation)
    });
  } catch {
    await markAvatarPreviewStatus(
      userId,
      outfitRecommendationId,
      String(loaded.avatarProfile._id),
      cacheKey,
      {
        status: "failed",
        errorMessage: "Unable to generate Digital Human Preview right now.",
        lastAttemptAt: new Date()
      }
    );

    return serializeStylistVisualization({
      visualMode,
      outfitRecommendationId,
      avatarPreview: defaultAvatarPreview({
        status: "failed",
        previewId: previewRecord?._id ? String(previewRecord._id) : null,
        cacheKey,
        errorMessage: "Unable to generate Digital Human Preview right now.",
        ...previewFitPatch(fitEvaluation)
      }),
      fitLock: fitLockSummary(fitEvaluation)
    });
  }
}

export function serializeStylistVisualization(result?: StylistVisualizationSerializeInput): StylistVisualizationResult {
  return {
    visualMode: result?.visualMode || "none",
    outfitRecommendationId: result?.outfitRecommendationId || null,
    avatarPreview: defaultAvatarPreview(result?.avatarPreview || {}),
    visualizationDisclaimer: result?.visualizationDisclaimer || stylistVisualizationDisclaimer,
    ...(result?.fitLock ? { fitLock: result.fitLock } : {}),
    ...(result?.job ? { job: serializeJob(result.job) } : {})
  };
}
