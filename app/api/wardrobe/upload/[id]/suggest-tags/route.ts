export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { suggestWardrobeTags } from "@/lib/ai/tagging";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { isObjectId } from "@/lib/wardrobe";
import { backgroundJobsEnabled, enqueueJob, serializeJob } from "@/lib/jobs/queue";
import { WardrobeUpload } from "@/models/WardrobeUpload";

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const meta = requestMeta(request);
<<<<<<< HEAD

  const limited = rateLimitPlaceholder({
    key: `wardrobe-suggest-tags:${meta.ip}`,
    limit: 20,
    windowMs: 60 * 1000
  });

=======
  const limited = rateLimitPlaceholder({ key: `wardrobe-suggest-tags:${meta.ip}`, limit: 20, windowMs: 60 * 1000, operation: "wardrobe-ai-analyze" });
>>>>>>> 77470c6 (AI)
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const id = context.params.id;

    if (!isObjectId(id)) {
      return apiError("NOT_FOUND", "Invalid wardrobe upload ID.");
    }

    const upload = await WardrobeUpload.findOne({
      _id: id,
      userId: auth.user._id
    });

    if (!upload) {
      return apiError("NOT_FOUND", "Wardrobe upload was not found.");
    }

    if (!upload.imageUrl && !upload.storageKey) {
      return apiError(
        "BAD_REQUEST",
        "Upload image is missing. Please re-upload."
      );
    }

    upload.aiTagStatus = "queued";
    upload.aiErrorSafeMessage = "";
    await upload.save();

    if (backgroundJobsEnabled()) {
      const job = await enqueueJob(
        "wardrobe_analysis",
        { uploadId: String(upload._id) },
        { userId: auth.user._id, maxAttempts: 3 }
      );

      return apiSuccess(
        {
          uploadId: String(upload._id),
          aiTagStatus: "queued",
          suggestedTags: {
            confidence: 0,
            needsReview: true
          },
          aiAnalysis: null,
          safeMessage: "FitPick is analyzing your garment intelligence.",
          job: serializeJob(job)
        },
        { message: "FitPick is analyzing your garment intelligence.", status: 202 }
      );
    }

    const result = await suggestWardrobeTags({
      uploadId: String(upload._id),
      filename: upload.filename || "",
      mimeType: upload.mimeType || "",
      storageKey: upload.storageKey || "",
      imageUrl: upload.imageUrl || "",
      thumbnailUrl: upload.thumbnailUrl || "",
      images: (upload.images || {}) as any,
      suggestedTags: upload.suggestedTags || {}
    });

    upload.aiProvider = result.provider;
    upload.aiConfidence = result.confidence ?? 0;
    upload.aiTagStatus = result.ok ? result.aiTagStatus : "failed";
    upload.suggestedTags = result.suggestedTags || {};
<<<<<<< HEAD
    upload.aiErrorSafeMessage = result.ok
      ? ""
      : result.safeMessage || "We could not analyze this image.";

=======
    upload.aiAnalysis = result.aiAnalysis || null;
    upload.aiErrorSafeMessage = result.ok ? "" : result.safeMessage || "We could not suggest tags for this item. You can add them manually.";
>>>>>>> 77470c6 (AI)
    await upload.save();

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "wardrobe.upload.suggest_tags",
      entityType: "WardrobeUpload",
      entityId: String(upload._id)
    });

    if (!result.ok || !result.suggestedTags) {
      return apiSuccess({
        uploadId: String(upload._id),
        aiTagStatus: "failed",
        suggestedTags: {
          confidence: 0,
          needsReview: true
        },
        aiAnalysis: null,
        safeMessage: upload.aiErrorSafeMessage
      });
    }

    return apiSuccess({
      uploadId: String(upload._id),
      aiTagStatus: upload.aiTagStatus,
      suggestedTags: result.suggestedTags,
      aiAnalysis: result.aiAnalysis || null,
      safeMessage: result.safeMessage
    });

  } catch (error) {
    console.error("Tagging error:", error);

    return apiError(
      "INTERNAL_ERROR",
      "We could not suggest tags for this item."
    );
  }
}
