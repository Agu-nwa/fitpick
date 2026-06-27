import { suggestWardrobeTags } from "@/lib/ai/tagging";
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

    return {
      preview: serializeOutfitPreview({ ...result.preview?.toObject?.() ?? result.preview, cached: result.cached })
    };
  }

  if (job.type === "wardrobe_analysis") {
    return runWardrobeAnalysisJob({
      userId,
      uploadId: String(payload.uploadId || "")
    });
  }

  return {
    skipped: true,
    reason: `${job.type} is not implemented in this worker version.`
  };
}
