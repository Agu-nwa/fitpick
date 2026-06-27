export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/audit";
import { processWardrobeImageVariant, serializeProcessedImageVariants } from "@/lib/image-processing/background-removal";
import { backgroundJobsEnabled, enqueueJob, serializeJob } from "@/lib/jobs/queue";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { logSafeError } from "@/lib/security/safe-log";
import { readJson, validateBody } from "@/lib/validation";
import { isObjectId } from "@/lib/wardrobe";
import { WardrobeItem } from "@/models/WardrobeItem";

const imageProcessingSchema = z.object({
  slot: z.enum(["front", "back", "fabricCloseUp", "label"]).default("front"),
  studioBackgroundPreset: z.enum(["luxury_dark", "ivory", "soft_gradient", "editorial_gray", "transparent"]).default("ivory")
});

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-image-processing:${meta.ip}`, limit: 12, windowMs: 60 * 1000, operation: "wardrobe-image-processing" });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    const parsed = validateBody(imageProcessingSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const item = await WardrobeItem.findOne({ _id: context.params.id, userId: auth.user._id });
    if (!item) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    const slot = parsed.data.slot || "front";
    const image = (item.images as any)?.[slot];
    if (!image?.storageKey && !image?.url) return apiError("BAD_REQUEST", "This wardrobe image is not available for processing.");

    if (backgroundJobsEnabled()) {
      const job = await enqueueJob(
        "garment_background_processing",
        {
          wardrobeItemId: String(item._id),
          imageSlot: slot,
          originalStorageKey: image.storageKey || "",
          studioBackgroundPreset: parsed.data.studioBackgroundPreset
        },
        { userId: auth.user._id, maxAttempts: 2 }
      );

      return apiSuccess(
        {
          processing: {
            status: "processing",
            safeMessage: "Studio image processing has been queued."
          },
          job: serializeJob(job)
        },
        { message: "Studio image processing queued.", status: 202 }
      );
    }

    const result = await processWardrobeImageVariant(
      String(auth.user._id),
      String(item._id),
      slot,
      image,
      {
        targetType: "item",
        studioBackgroundPreset: parsed.data.studioBackgroundPreset
      }
    );

    return apiSuccess({ processing: serializeProcessedImageVariants(result) }, { message: "Studio image processing checked." });
  } catch (error) {
    logSafeError("wardrobe.image-processing", error);
    return apiError("INTERNAL_ERROR", "Unable to process this wardrobe image right now.");
  }
}
