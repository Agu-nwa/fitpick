export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getAiModel } from "@/lib/ai/models/registry";
import { errorCategory, logAiEvent } from "@/lib/ai/observability/ai-logger";
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
import { serializeAvatarProfile } from "@/lib/avatar/avatar-profile";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/audit";
import { evaluateOutfitFitOnAvatar } from "@/lib/fit/fit-lock";
import { backgroundJobsEnabled, enqueueJob, serializeJob } from "@/lib/jobs/queue";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { logSafeError } from "@/lib/security/safe-log";
import { readJson, validateBody } from "@/lib/validation";
import { isObjectId } from "@/lib/wardrobe";
import { AvatarOutfitPreview } from "@/models/AvatarOutfitPreview";

type RouteContext = {
  params: {
    id: string;
  };
};

const avatarPreviewRequestSchema = z.object({
  visualizationStyle: z.enum(["minimal", "luxury", "streetwear", "editorial"]).optional(),
  posePreset: z.enum(["standing", "walking", "editorial", "runway", "casual"]).optional(),
  regenerate: z.boolean().default(false)
});

export async function GET(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `avatar-preview:get:${meta.ip}`, limit: 60, windowMs: 60 * 1000, operation: "avatar-preview-get" });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Outfit was not found.");

    const loaded = await loadOwnedAvatarPreviewSubject(String(auth.user._id), context.params.id);
    if (!loaded) return apiError("NOT_FOUND", "Outfit was not found.");

    const options = {
      visualizationStyle: loaded.avatarProfile.visualizationStyle,
      posePreset: loaded.avatarProfile.posePreset
    };
    const cacheKey = buildAvatarCacheKeyFromItems(String(auth.user._id), context.params.id, loaded.items, loaded.avatarProfile, options);
    const cached = await getCachedAvatarPreview(String(auth.user._id), context.params.id, cacheKey);
    const latest = cached || await AvatarOutfitPreview.findOne({ userId: auth.user._id, outfitId: context.params.id }).sort({ updatedAt: -1 }).lean();

    return apiSuccess({
      preview: serializeAvatarPreview(latest || null),
      avatarProfile: serializeAvatarProfile(loaded.avatarProfile)
    });
  } catch (error) {
    logSafeError("avatar-preview.get", error);
    return apiError("INTERNAL_ERROR", "Unable to load Digital Human Preview right now.");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `avatar-preview:post:${meta.ip}`, limit: 8, windowMs: 60 * 1000, operation: "avatar-preview-generation" });
  if (limited) return limited;

  let activeCacheKey = "";
  let activeUserId = "";
  let activeAvatarProfileId = "";

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Outfit was not found.");
    activeUserId = String(auth.user._id);

    const parsed = validateBody(avatarPreviewRequestSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    if (!process.env.OPENAI_API_KEY) {
      return apiError("INTERNAL_ERROR", "Digital Human image generation is not configured yet.");
    }

    const loaded = await loadOwnedAvatarPreviewSubject(activeUserId, context.params.id);
    if (!loaded) return apiError("NOT_FOUND", "Outfit was not found.");
    if (loaded.missingItems || !loaded.items.length) {
      return apiError("BAD_REQUEST", "This Digital Human Preview needs all selected owned wardrobe items available.");
    }

    if (!loaded.avatarProfile.consentAccepted) {
      return apiError("BAD_REQUEST", "Please review and save your Digital Human settings before generating an avatar look.");
    }

    activeAvatarProfileId = String(loaded.avatarProfile._id);
    const options = {
      visualizationStyle: parsed.data.visualizationStyle || loaded.avatarProfile.visualizationStyle || "luxury",
      posePreset: parsed.data.posePreset || loaded.avatarProfile.posePreset || "standing"
    };
    const fitEvaluation = evaluateOutfitFitOnAvatar(loaded.avatarProfile, loaded.items);
    const cacheKey = buildAvatarCacheKeyFromItems(activeUserId, context.params.id, loaded.items, loaded.avatarProfile, options);
    activeCacheKey = cacheKey;

    const cached = parsed.data.regenerate ? null : await getCachedAvatarPreview(activeUserId, context.params.id, cacheKey) as any;
    if (cached?.imageUrl) {
      logAiEvent({
        operation: "avatar-preview",
        model: cached.model || getAiModel("imageGeneration"),
        latencyMs: 0,
        status: "success",
        cacheHit: true,
        provider: cached.provider || "s3"
      });
      return apiSuccess({
        preview: serializeAvatarPreview({ ...cached, cached: true }),
        avatarProfile: serializeAvatarProfile(loaded.avatarProfile)
      });
    }

    const inFlight = await AvatarOutfitPreview.findOne({
      userId: auth.user._id,
      outfitId: context.params.id,
      cacheKey,
      status: "generating",
      lastAttemptAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
    }).lean() as any;

    if (inFlight && !parsed.data.regenerate) {
      return apiSuccess({
        preview: serializeAvatarPreview(inFlight),
        avatarProfile: serializeAvatarProfile(loaded.avatarProfile)
      }, { message: "Digital Human Preview generation is already in progress." });
    }

    const latestAttempt = await AvatarOutfitPreview.findOne({
      userId: auth.user._id,
      outfitId: context.params.id,
      cacheKey
    }).lean() as any;

    if ((latestAttempt?.attempts || 0) >= 5 && !parsed.data.regenerate) {
      return apiError("RATE_LIMITED", "Digital Human Preview generation has been retried several times. Please try again later.");
    }

    await markAvatarPreviewStatus(
      activeUserId,
      context.params.id,
      activeAvatarProfileId,
      cacheKey,
      {
        userId: auth.user._id,
        outfitId: loaded.outfit._id,
        avatarProfileId: loaded.avatarProfile._id,
        itemIds: loaded.itemIds,
        cacheKey,
        status: "generating",
        provider: "s3",
        promptVersion: avatarPreviewPromptVersion,
        model: getAiModel("imageGeneration"),
        visualizationStyle: options.visualizationStyle,
        posePreset: options.posePreset,
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
          outfitId: context.params.id,
          avatarProfileId: activeAvatarProfileId,
          visualizationStyle: options.visualizationStyle,
          posePreset: options.posePreset,
          cacheKey
        },
        {
          userId: auth.user._id,
          maxAttempts: 3
        }
      );

      return apiSuccess(
        {
          preview: serializeAvatarPreview({
            status: "generating",
            provider: "s3",
            cacheKey,
            promptVersion: avatarPreviewPromptVersion,
            model: getAiModel("imageGeneration"),
            visualizationStyle: options.visualizationStyle,
            posePreset: options.posePreset,
            accuracyLevel: fitEvaluation.accuracyLevel.id,
            fitStatus: fitEvaluation.fitStatus,
            fitConfidence: fitEvaluation.fitConfidence,
            fitWarnings: fitEvaluation.warnings,
            fitLockInstructions: fitEvaluation.lockedFitInstructions
          }),
          avatarProfile: serializeAvatarProfile(loaded.avatarProfile),
          job: serializeJob(job)
        },
        { message: "Your Digital Human Preview is being styled.", status: 202 }
      );
    }

    const generated = await generateAvatarOutfitPreview(activeUserId, loaded.outfit, loaded.items, loaded.avatarProfile, { ...options, cacheKey });
    const saved = await saveAvatarPreview(activeUserId, context.params.id, activeAvatarProfileId, generated, loaded.itemIds, cacheKey);

    return apiSuccess({
      preview: serializeAvatarPreview(saved),
      avatarProfile: serializeAvatarProfile(loaded.avatarProfile)
    }, { message: "Digital Human Preview generated.", status: 201 });
  } catch (error) {
    try {
      if (activeUserId && activeAvatarProfileId && isObjectId(context.params.id)) {
        await markAvatarPreviewStatus(
          activeUserId,
          context.params.id,
          activeAvatarProfileId,
          activeCacheKey || `failed:${context.params.id}`,
          {
            cacheKey: activeCacheKey || `failed:${context.params.id}`,
            status: "failed",
            errorMessage: "Unable to generate Digital Human Preview right now.",
            lastAttemptAt: new Date()
          }
        );
      }
    } catch {
      // Keep failure bookkeeping from leaking raw provider errors.
    }

    logAiEvent({
      operation: "avatar-preview",
      model: getAiModel("imageGeneration"),
      latencyMs: 0,
      status: "failed",
      cacheHit: false,
      provider: "s3",
      errorCategory: errorCategory(error)
    });

    return apiError("INTERNAL_ERROR", "Unable to generate Digital Human Preview right now.");
  }
}
