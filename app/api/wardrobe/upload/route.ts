export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { backgroundJobsEnabled, enqueueJob } from "@/lib/jobs/queue";
import { assertStorageConfigured, createWardrobeStorageKey, storageKeyBelongsToUser } from "@/lib/storage";
import { logSafeError } from "@/lib/security/safe-log";
import { getPublicStorageUrl, normalizeStorageKey } from "@/lib/storage/url";
import { readJson, validateBody } from "@/lib/validation";
import { serializeWardrobeUpload } from "@/lib/wardrobe";
import { WardrobeUpload } from "@/models/WardrobeUpload";
import { uploadMetadataSchema } from "@/schemas/wardrobe.schema";

function withOriginalVariant(asset: any, fallback: { width?: number; height?: number; bytes?: number }) {
  if (!asset?.url && !asset?.storageKey) return asset;
  return {
    ...asset,
    variants: {
      ...(asset.variants || {}),
      original: {
        url: asset.url || "",
        storageKey: asset.storageKey || "",
        provider: asset.provider || "s3",
        width: fallback.width || 0,
        height: fallback.height || 0,
        bytes: fallback.bytes || 0,
        status: "ready",
        processedAt: asset.uploadedAt || new Date().toISOString()
      }
    }
  };
}

function sanitizeImageAssets(images: any, userId: string, fallback: { width?: number; height?: number; bytes?: number }) {
  if (!images) return { ok: true as const, images: undefined };

  function sanitizeAsset(asset: any, purpose: string) {
    if (!asset) return undefined;
    const storageKey = normalizeStorageKey(asset.storageKey || "");
    if (asset.provider === "s3" && !storageKeyBelongsToUser({ userId, storageKey, prefix: "wardrobe" })) {
      return null;
    }

    return {
      ...withOriginalVariant(asset, fallback),
      purpose,
      storageKey,
      url: asset.provider === "s3" && storageKey ? getPublicStorageUrl(storageKey) : asset.url
    };
  }

  const front = sanitizeAsset(images.front, "front");
  const back = sanitizeAsset(images.back, "back");
  const fabricCloseUp = sanitizeAsset(images.fabricCloseUp, "fabricCloseUp");
  const label = sanitizeAsset(images.label, "label");
  const additional = (images.additional || []).map((asset: any) => sanitizeAsset(asset, "additional"));

  if ([front, back, fabricCloseUp, label, ...additional].some((asset) => asset === null)) {
    return { ok: false as const, response: apiError("BAD_REQUEST", "Upload image reference is invalid.") };
  }

  return {
    ok: true as const,
    images: {
      ...(front ? { front } : {}),
      ...(back ? { back } : {}),
      ...(fabricCloseUp ? { fabricCloseUp } : {}),
      ...(label ? { label } : {}),
      additional: additional.filter(Boolean)
    }
  };
}

export async function POST(request: NextRequest) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-upload:${meta.ip}`, limit: 20, windowMs: 60 * 1000, operation: "wardrobe-upload" });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(uploadMetadataSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const userId = String(auth.user._id);
    const storage = assertStorageConfigured();
    const submittedStorageKey = normalizeStorageKey(parsed.data.publicId || parsed.data.storageKey || "");
    if (submittedStorageKey && !storageKeyBelongsToUser({ userId, storageKey: submittedStorageKey, prefix: "wardrobe" })) {
      return apiError("BAD_REQUEST", "Upload object is invalid.");
    }

    const variantFallback = { width: parsed.data.width || 0, height: parsed.data.height || 0, bytes: parsed.data.sizeBytes || 0 };
    const sanitizedImages = sanitizeImageAssets(parsed.data.images, userId, variantFallback);
    if (!sanitizedImages.ok) return sanitizedImages.response;

    const storageKey =
      submittedStorageKey ||
      createWardrobeStorageKey({
        userId,
        filename: parsed.data.filename
      });
    const imageUrl = parsed.data.provider === "s3" && storageKey ? getPublicStorageUrl(storageKey) : parsed.data.secureUrl || parsed.data.imageUrl || "";
    const thumbnailUrl = parsed.data.thumbnailUrl || imageUrl;
    const images = sanitizedImages.images || (imageUrl
      ? {
          front: {
            url: imageUrl,
            storageKey,
            provider: parsed.data.provider || storage.provider,
            uploadedAt: new Date().toISOString(),
            purpose: "front",
            variants: {
              original: {
                url: imageUrl,
                storageKey,
                provider: parsed.data.provider || storage.provider,
                width: parsed.data.width || 0,
                height: parsed.data.height || 0,
                bytes: parsed.data.sizeBytes || 0,
                status: "ready",
                processedAt: new Date().toISOString()
              }
            }
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

    if (backgroundJobsEnabled()) {
      const processableSlots = ["front", "back"] as const;
      await Promise.all(
        processableSlots
          .filter((slot) => (upload.images as any)?.[slot]?.storageKey)
          .map((slot) =>
            enqueueJob(
              "garment_background_processing",
              {
                uploadId: String(upload._id),
                imageSlot: slot,
                originalStorageKey: (upload.images as any)?.[slot]?.storageKey,
                studioBackgroundPreset: process.env.FITPICK_STUDIO_BACKGROUND_PRESET || "ivory"
              },
              { userId: auth.user._id, maxAttempts: 2 }
            )
          )
      );
    }

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
    logSafeError("wardrobe.upload.create", error);
    return apiError("INTERNAL_ERROR", "Unable to create wardrobe upload right now.");
  }
}
