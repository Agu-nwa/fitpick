import { suggestWardrobeTags } from "@/lib/ai/tagging";
import { runAvatarPreviewGenerationJob, serializeAvatarPreview } from "@/lib/avatar/avatar-preview";
import { processWardrobeImageVariant, serializeProcessedImageVariants } from "@/lib/image-processing/background-removal";
import { runOutfitPreviewGenerationJob, serializeOutfitPreview } from "@/lib/outfit-preview/outfit-preview";
import { WardrobeUpload } from "@/models/WardrobeUpload";

export async function runWardrobeAnalysisJob(input: { userId: string; uploadId: string }) {
  const upload = await WardrobeUpload.findOne({ _id: input.uploadId, userId: input.userId });
  if (!upload) throw new Error("Wardrobe upload was not found.");

  upload.aiTagStatus = "queued";
  upload.aiErrorSafeMessage = "";
  await upload.save();

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
  upload.aiConfidence = result.confidence || result.suggestedTags?.confidence || 0;
  upload.aiTagStatus = result.ok && result.suggestedTags ? result.aiTagStatus : "failed";
  upload.suggestedTags = result.suggestedTags || {};
  upload.aiAnalysis = result.aiAnalysis || null;
  upload.aiErrorSafeMessage = result.ok ? "" : result.safeMessage || "We could not suggest tags for this item. You can add them manually.";
  await upload.save();

  return {
    uploadId: String(upload._id),
    aiTagStatus: upload.aiTagStatus,
    ok: result.ok,
    confidence: upload.aiConfidence
  };
}

export async function runBackgroundJobByType(job: any) {
  const payload = job.payload || {};
  const userId = String(job.userId);

  if (job.type === "outfit_preview_generation") {
    const result = await runOutfitPreviewGenerationJob({
      userId,
      outfitId: String(payload.outfitId || ""),
      style: payload.style || "flat_lay",
      cacheKey: payload.cacheKey
    });
    const preview = (result.preview as any)?.toObject?.() ?? result.preview;

    return {
      preview: serializeOutfitPreview({ ...preview, cached: result.cached })
    };
  }

  if (job.type === "avatar_preview_generation") {
    const result = await runAvatarPreviewGenerationJob({
      userId,
      outfitId: String(payload.outfitId || ""),
      avatarProfileId: String(payload.avatarProfileId || ""),
      visualizationStyle: payload.visualizationStyle || undefined,
      posePreset: payload.posePreset || undefined,
      cacheKey: payload.cacheKey
    });
    const preview = (result.preview as any)?.toObject?.() ?? result.preview;

    return {
      preview: serializeAvatarPreview({ ...preview, cached: result.cached })
    };
  }

  if (job.type === "wardrobe_analysis") {
    return runWardrobeAnalysisJob({
      userId,
      uploadId: String(payload.uploadId || "")
    });
  }

  if (job.type === "garment_background_processing") {
    const result = await processWardrobeImageVariant(
      userId,
      String(payload.wardrobeItemId || payload.uploadId || ""),
      String(payload.imageSlot || "front") as any,
      undefined,
      {
        targetType: payload.wardrobeItemId ? "item" : "upload",
        studioBackgroundPreset: String(payload.studioBackgroundPreset || "")
      }
    );

    return serializeProcessedImageVariants(result);
  }

  return {
    skipped: true,
    reason: `${job.type} is not implemented in this worker version.`
  };
}
