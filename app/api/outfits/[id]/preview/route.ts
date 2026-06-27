export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/audit";
import { getAiModel } from "@/lib/ai/models/registry";
import { errorCategory, logAiEvent } from "@/lib/ai/observability/ai-logger";
import {
  buildPreviewCacheKeyFromItems,
  generateOutfitPreview,
  getCachedOutfitPreview,
  loadOwnedPreviewSubject,
  previewPromptVersion,
  saveGeneratedPreview,
  serializeOutfitPreview
} from "@/lib/outfit-preview/outfit-preview";
import { backgroundJobsEnabled, enqueueJob, serializeJob } from "@/lib/jobs/queue";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { readJson, validateBody } from "@/lib/validation";
import { isObjectId } from "@/lib/wardrobe";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { OutfitPreview } from "@/models/OutfitPreview";
import { WardrobeItem } from "@/models/WardrobeItem";

type RouteContext = {
  params: {
    id: string;
  };
};

const previewRequestSchema = z.object({
  style: z.enum(["flat_lay", "mannequin", "lifestyle_editorial", "luxury_lookbook"]).default("flat_lay"),
  regenerate: z.boolean().default(false)
});

async function loadOwnedOutfitAndItems(userId: any, outfitId: string) {
  if (!isObjectId(outfitId)) return null;
  return loadOwnedPreviewSubject(String(userId), outfitId);
}

async function markPreview(
  userId: any,
  outfitId: string,
  cacheKey: string,
  patch: Record<string, unknown>,
  incrementAttempt = false
) {
  const update: Record<string, unknown> = {
    $set: patch
  };

  if (incrementAttempt) update.$inc = { attempts: 1 };

  await OutfitPreview.findOneAndUpdate(
    { userId, outfitId, cacheKey },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const outfitUpdate: Record<string, unknown> = {
    $set: Object.fromEntries(Object.entries(patch).map(([key, value]) => [`preview.${key}`, value]))
  };

  if (incrementAttempt) outfitUpdate.$inc = { "preview.attempts": 1 };

  await OutfitRecommendation.findOneAndUpdate({ _id: outfitId, userId }, outfitUpdate);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `outfit-preview:get:${meta.ip}`, limit: 60, windowMs: 60 * 1000, operation: "outfit-preview-get" });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const loaded = await loadOwnedOutfitAndItems(auth.user._id, context.params.id);
    if (!loaded) return apiError("NOT_FOUND", "Outfit was not found.");

    const cacheKey = buildPreviewCacheKeyFromItems(String(auth.user._id), context.params.id, loaded.items, { style: "flat_lay" });
    const cached = await getCachedOutfitPreview(String(auth.user._id), context.params.id, cacheKey);
    const latest = cached || await OutfitPreview.findOne({ userId: auth.user._id, outfitId: context.params.id }).sort({ updatedAt: -1 }).lean();

    return apiSuccess({ preview: serializeOutfitPreview(latest || loaded.outfit.preview) });
  } catch {
    return apiError("INTERNAL_ERROR", "Unable to load outfit preview right now.");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `outfit-preview:post:${meta.ip}`, limit: 10, windowMs: 60 * 1000, operation: "outfit-preview-generation" });
  if (limited) return limited;
  let activeCacheKey = "";
  let activeUserId: any = null;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    activeUserId = auth.user._id;

    const parsed = validateBody(previewRequestSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    if (!process.env.OPENAI_API_KEY) {
      return apiError("INTERNAL_ERROR", "Image generation is not configured yet.");
    }

    const loaded = await loadOwnedOutfitAndItems(auth.user._id, context.params.id);
    if (!loaded) return apiError("NOT_FOUND", "Outfit was not found.");
    if (loaded.missingItems || !loaded.items.length) {
      return apiError("BAD_REQUEST", "This outfit needs all owned wardrobe items available before generating a preview.");
    }

    const cacheKey = buildPreviewCacheKeyFromItems(String(auth.user._id), context.params.id, loaded.items, parsed.data);
    activeCacheKey = cacheKey;
    const cached = (parsed.data.regenerate ? null : await getCachedOutfitPreview(String(auth.user._id), context.params.id, cacheKey)) as any;

    if (cached?.imageUrl) {
      logAiEvent({
        operation: "outfit-preview",
        model: cached.model || getAiModel("imageGeneration"),
        latencyMs: 0,
        status: "success",
        cacheHit: true,
        provider: cached.provider || "s3"
      });
      return apiSuccess({ preview: serializeOutfitPreview({ ...cached, cached: true }) });
    }

    const inFlight = await OutfitPreview.findOne({
      userId: auth.user._id,
      outfitId: context.params.id,
      cacheKey,
      status: "generating",
      lastAttemptAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
    }).lean() as any;

    if (inFlight && !parsed.data.regenerate) {
      return apiSuccess({
        preview: serializeOutfitPreview(inFlight)
      }, { message: "Preview generation is already in progress." });
    }

    const latestAttempt = await OutfitPreview.findOne({
      userId: auth.user._id,
      outfitId: context.params.id,
      cacheKey
    }).lean() as any;

    if ((latestAttempt?.attempts || 0) >= 5 && !parsed.data.regenerate) {
      return apiError("RATE_LIMITED", "Preview generation has been retried several times. Please try again later.");
    }

    await markPreview(
      auth.user._id,
      context.params.id,
      cacheKey,
      {
        userId: auth.user._id,
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
          outfitId: context.params.id,
          style: parsed.data.style,
          cacheKey
        },
        {
          userId: auth.user._id,
          maxAttempts: 3
        }
      );

      return apiSuccess(
        {
          preview: serializeOutfitPreview({
            status: "generating",
            provider: "s3",
            cacheKey,
            promptVersion: previewPromptVersion,
            model: getAiModel("imageGeneration")
          }),
          job: serializeJob(job)
        },
        { message: "Your preview is being styled.", status: 202 }
      );
    }

    const generated = await generateOutfitPreview(String(auth.user._id), loaded.outfit, loaded.items, parsed.data);
    const saved = await saveGeneratedPreview(String(auth.user._id), context.params.id, generated, cacheKey);

    return apiSuccess({ preview: serializeOutfitPreview(saved) }, { message: "Premium outfit preview generated.", status: 201 });
  } catch (error) {
    try {
      if (activeUserId && isObjectId(context.params.id)) {
        await markPreview(
          activeUserId,
          context.params.id,
          activeCacheKey || `failed:${context.params.id}`,
          {
            cacheKey: activeCacheKey || `failed:${context.params.id}`,
            status: "failed",
            errorMessage: "Unable to generate preview right now.",
            lastAttemptAt: new Date()
          },
          false
        );
      }
    } catch {
      // Keep the user-facing error safe even if failure bookkeeping fails.
    }

    logAiEvent({
      operation: "outfit-preview",
      model: getAiModel("imageGeneration"),
      latencyMs: 0,
      status: "failed",
      cacheHit: false,
      provider: "s3",
      errorCategory: errorCategory(error)
    });

    return apiError("INTERNAL_ERROR", "Unable to generate outfit preview right now.");
  }
}
