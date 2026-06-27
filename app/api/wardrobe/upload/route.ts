export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { assertStorageConfigured, createWardrobeStorageKey } from "@/lib/storage";
import { readJson, validateBody } from "@/lib/validation";
import { serializeWardrobeUpload } from "@/lib/wardrobe";
import { WardrobeUpload } from "@/models/WardrobeUpload";
import { uploadMetadataSchema } from "@/schemas/wardrobe.schema";

export async function POST(request: NextRequest) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-upload:${meta.ip}`, limit: 20, windowMs: 60 * 1000, operation: "wardrobe-upload" });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(uploadMetadataSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const storage = assertStorageConfigured();
    const storageKey =
      parsed.data.publicId ||
      parsed.data.storageKey ||
      createWardrobeStorageKey({
        userId: String(auth.user._id),
        filename: parsed.data.filename
      });
    const imageUrl = parsed.data.secureUrl || parsed.data.imageUrl || "";
    const thumbnailUrl = parsed.data.thumbnailUrl || imageUrl;
    const images = parsed.data.images || (imageUrl
      ? {
          front: {
            url: imageUrl,
            storageKey,
            provider: parsed.data.provider || storage.provider,
            uploadedAt: new Date().toISOString(),
            purpose: "front"
          },
          additional: []
        }
      : { additional: [] });

    const upload = await WardrobeUpload.create({
      userId: auth.user._id,
      storageKey,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      width: parsed.data.width || 0,
      height: parsed.data.height || 0,
      provider: parsed.data.provider || storage.provider,
      imageUrl,
      thumbnailUrl,
      images,
      uploadStatus: parsed.data.uploadStatus || (imageUrl ? "uploaded" : storage.ready ? "pending" : "uploaded"),
      aiTagStatus: parsed.data.suggestedTags ? "suggested" : "not_started",
      suggestedTags: parsed.data.suggestedTags || {}
    });

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "wardrobe.upload",
      entityType: "WardrobeUpload",
      entityId: String(upload._id)
    });

    return apiSuccess(
      {
        upload: serializeWardrobeUpload(upload),
        storage: {
          provider: storage.provider,
          ready: storage.ready,
          mode: storage.ready ? "provider-ready" : "metadata-only"
        },
        nextAction: "review-tags"
      },
      { message: "Wardrobe upload record created.", status: 201 }
    );
  } catch (error) {
    console.error("FitPick wardrobe upload error:", error);
    return apiError("INTERNAL_ERROR", "Unable to create wardrobe upload right now.");
  }
}
