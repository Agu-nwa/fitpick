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
  const limited = rateLimitPlaceholder({ key: `wardrobe-upload:${meta.ip}`, limit: 20, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(uploadMetadataSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const storage = assertStorageConfigured();
    const storageKey = createWardrobeStorageKey({
      userId: String(auth.user._id),
      filename: parsed.data.filename
    });

    const upload = await WardrobeUpload.create({
      userId: auth.user._id,
      storageKey,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      width: parsed.data.width || 0,
      height: parsed.data.height || 0,
      provider: storage.provider,
      uploadStatus: storage.ready ? "pending" : "uploaded",
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
