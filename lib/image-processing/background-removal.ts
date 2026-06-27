import crypto from "crypto";
import { getStudioBackgroundPreset } from "@/lib/image-processing/studio-backgrounds";
import { logSafeError } from "@/lib/security/safe-log";
import { getGeneratedImageUrl, uploadGeneratedImage } from "@/lib/storage/generated-images";
import { normalizeStorageKey } from "@/lib/storage/url";
import { WardrobeItem } from "@/models/WardrobeItem";
import { WardrobeUpload } from "@/models/WardrobeUpload";

type ImageSlot = "front" | "back" | "fabricCloseUp" | "label" | "additional";
type ProcessingTargetType = "upload" | "item";
type ProcessingStatus = "not_started" | "processing" | "ready" | "failed" | "unavailable";

type ProcessInput = {
  userId: string;
  targetId: string;
  targetType?: ProcessingTargetType;
  slot: ImageSlot;
  originalImage?: any;
  studioBackgroundPreset?: string;
};

type ProcessedVariant = {
  url: string;
  storageKey: string;
  provider: "s3";
  width: number;
  height: number;
  bytes: number;
  status: ProcessingStatus;
  backgroundPreset?: string;
  processedAt?: Date;
  errorMessage?: string;
};

type ProcessingResult = {
  ok: boolean;
  status: ProcessingStatus;
  safeMessage?: string;
  image?: ProcessedVariant;
};

type RemoveBackgroundInput = {
  userId: string;
  targetId: string;
  slot: ImageSlot;
  originalImage: any;
  variant: "cutout" | "studio";
  studioBackgroundPreset?: string;
};

type RemoveBackgroundRequest = Omit<RemoveBackgroundInput, "variant">;

const supportedSlots = new Set(["front", "back", "fabricCloseUp", "label", "additional"]);
const maxProviderInputBytes = 12 * 1024 * 1024;
const removeBgEndpoint = "https://api.remove.bg/v1.0/removebg";

function backgroundRemovalProvider() {
  return (process.env.BACKGROUND_REMOVAL_PROVIDER || "none").toLowerCase();
}

function safeUnavailable(message = "Studio image processing is unavailable.") {
  return {
    ok: false,
    status: "unavailable" as const,
    safeMessage: message
  };
}

function originalVariant(image: any): ProcessedVariant {
  return {
    url: image?.url || "",
    storageKey: normalizeStorageKey(image?.storageKey || ""),
    provider: image?.provider === "s3" ? "s3" : "s3",
    width: image?.width || image?.variants?.original?.width || 0,
    height: image?.height || image?.variants?.original?.height || 0,
    bytes: image?.bytes || image?.variants?.original?.bytes || 0,
    status: image?.url || image?.storageKey ? "ready" : "not_started",
    processedAt: image?.uploadedAt ? new Date(image.uploadedAt) : new Date()
  };
}

function unavailableVariant(backgroundPreset = "", message = "Provider unavailable. Original image kept."): ProcessedVariant {
  return {
    url: "",
    storageKey: "",
    provider: "s3",
    width: 0,
    height: 0,
    bytes: 0,
    status: "unavailable",
    backgroundPreset,
    processedAt: new Date(),
    errorMessage: message
  };
}

function readyVariant(input: {
  uploaded: Awaited<ReturnType<typeof uploadGeneratedImage>>;
  originalImage: any;
  backgroundPreset?: string;
}): ProcessedVariant {
  return {
    url: input.uploaded.url,
    storageKey: input.uploaded.storageKey,
    provider: "s3",
    width: input.uploaded.width || input.originalImage?.width || input.originalImage?.variants?.original?.width || 0,
    height: input.uploaded.height || input.originalImage?.height || input.originalImage?.variants?.original?.height || 0,
    bytes: input.uploaded.bytes,
    status: "ready",
    backgroundPreset: input.backgroundPreset || "",
    processedAt: new Date(),
    errorMessage: ""
  };
}

function sourceImageUrl(image: any) {
  return image?.url || image?.variants?.original?.url || "";
}

function sourceStorageKey(image: any) {
  return normalizeStorageKey(image?.storageKey || image?.variants?.original?.storageKey || "");
}

async function loadOriginalImageForProvider(image: any) {
  const url = sourceImageUrl(image) || (sourceStorageKey(image) ? await getGeneratedImageUrl(sourceStorageKey(image)) : "");
  if (!url) throw new Error("original_image_unavailable");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`original_image_fetch_failed_${response.status}`);

  const contentType = (response.headers.get("content-type") || image?.mimeType || "image/png").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("original_image_content_type_invalid");

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.byteLength || buffer.byteLength > maxProviderInputBytes) throw new Error("original_image_size_invalid");

  return {
    buffer,
    contentType
  };
}

function studioBackgroundColor(value?: string) {
  const preset = getStudioBackgroundPreset(value);
  if (preset.background.type === "transparent") return null;

  const hex = preset.background.value.match(/#[0-9a-f]{6}/i)?.[0] || "#f7f2ea";
  return hex.replace("#", "");
}

async function callRemoveBg(input: { originalImage: any; backgroundColor?: string | null }) {
  const apiKey = process.env.BACKGROUND_REMOVAL_API_KEY || "";
  if (!apiKey) throw new Error("removebg_credentials_missing");

  const original = await loadOriginalImageForProvider(input.originalImage);
  const form = new FormData();
  form.append("image_file", new Blob([original.buffer as BlobPart], { type: original.contentType }), "garment.png");
  form.append("size", "auto");
  form.append("format", "png");
  if (input.backgroundColor) form.append("bg_color", input.backgroundColor);

  const response = await fetch(removeBgEndpoint, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey
    },
    body: form
  });

  if (!response.ok) throw new Error(`removebg_failed_${response.status}`);

  const result = Buffer.from(await response.arrayBuffer());
  if (!result.byteLength || result.byteLength > 12 * 1024 * 1024) throw new Error("removebg_result_size_invalid");
  return result;
}

async function uploadProcessedVariant(input: RemoveBackgroundInput & { buffer: Buffer; backgroundPreset?: string }) {
  const storageKey = buildWardrobeVariantStorageKey({
    userId: input.userId,
    targetId: input.targetId,
    slot: input.slot,
    variant: input.variant,
    preset: input.backgroundPreset,
    format: "png"
  });

  const uploaded = await uploadGeneratedImage(input.buffer, {
    userId: input.userId,
    outfitId: input.targetId,
    cacheKey: `${input.targetId}:${input.slot}:${input.variant}:${input.backgroundPreset || "transparent"}`,
    storageKey,
    contentType: "image/png",
    format: "png",
    width: input.originalImage?.width || input.originalImage?.variants?.original?.width || 0,
    height: input.originalImage?.height || input.originalImage?.variants?.original?.height || 0
  });

  return readyVariant({
    uploaded,
    originalImage: input.originalImage,
    backgroundPreset: input.backgroundPreset
  });
}

export function buildWardrobeVariantStorageKey(input: {
  userId: string;
  targetId: string;
  slot: ImageSlot;
  variant: "original" | "cutout" | "studio" | "thumb";
  preset?: string;
  format?: "jpg" | "png";
}) {
  const suffix = input.variant === "studio" && input.preset ? `${input.variant}-${input.preset}` : input.variant;
  return normalizeStorageKey(
    `wardrobe/${input.userId}/${input.targetId}/${input.slot}/${suffix}-${Date.now()}-${crypto.randomUUID()}.${input.format || "png"}`
  );
}

export async function removeGarmentBackground(input: RemoveBackgroundRequest): Promise<ProcessingResult> {
  const provider = backgroundRemovalProvider();
  if (!input.originalImage?.storageKey && !input.originalImage?.url) {
    return safeUnavailable("Original image is unavailable.");
  }

  if (provider === "none") {
    return safeUnavailable("Background removal provider is not configured.");
  }

  if (!process.env.BACKGROUND_REMOVAL_API_KEY) {
    return safeUnavailable("Background removal provider credentials are not configured.");
  }

  if (provider !== "removebg") {
    return safeUnavailable(`Background removal provider '${provider}' is not enabled in this build.`);
  }

  try {
    const buffer = await callRemoveBg({ originalImage: input.originalImage });
    const image = await uploadProcessedVariant({ ...input, variant: "cutout", buffer });
    return {
      ok: true,
      status: "ready",
      image
    };
  } catch (error) {
    logSafeError("image-processing.removebg.cutout", error, {
      provider,
      targetType: "wardrobe-image",
      slot: input.slot
    });

    return {
      ok: false,
      status: "failed",
      safeMessage: "Unable to remove the garment background right now."
    };
  }
}

export async function createTransparentCutout(input: RemoveBackgroundRequest) {
  return removeGarmentBackground(input);
}

export async function applyFitPickStudioBackground(
  cutout: { ok: boolean; status: ProcessingStatus; image?: ProcessedVariant },
  options: RemoveBackgroundRequest & { studioBackgroundPreset?: string }
): Promise<ProcessingResult> {
  const preset = getStudioBackgroundPreset(options.studioBackgroundPreset);
  if (!cutout.ok || cutout.status !== "ready" || !cutout.image?.storageKey) {
    return safeUnavailable(`Studio background '${preset.label}' requires a successful garment cutout.`);
  }

  if (preset.background.type === "transparent") {
    return {
      ok: true,
      status: "ready",
      image: {
        ...cutout.image,
        backgroundPreset: preset.id
      }
    };
  }

  const provider = backgroundRemovalProvider();
  if (provider !== "removebg") {
    return safeUnavailable(`Studio background provider '${provider}' is not enabled in this build.`);
  }

  try {
    const buffer = await callRemoveBg({
      originalImage: options.originalImage,
      backgroundColor: studioBackgroundColor(preset.id)
    });
    const image = await uploadProcessedVariant({
      ...options,
      variant: "studio",
      backgroundPreset: preset.id,
      buffer
    });

    return {
      ok: true,
      status: "ready",
      image
    };
  } catch (error) {
    logSafeError("image-processing.removebg.studio", error, {
      provider,
      targetType: "wardrobe-image",
      slot: options.slot,
      preset: preset.id
    });

    return {
      ok: false,
      status: "failed",
      safeMessage: `Unable to create the ${preset.label} studio image right now.`
    };
  }
}

function imageWithVariants(image: any, patch: Record<string, ProcessedVariant>) {
  return {
    ...(image || {}),
    variants: {
      ...(image?.variants || {}),
      ...patch
    }
  };
}

async function updateTarget(input: ProcessInput, variants: Record<string, ProcessedVariant>) {
  const Model = input.targetType === "item" ? WardrobeItem : WardrobeUpload;
  const setPath = `images.${input.slot}.variants`;
  return (Model as any).findOneAndUpdate(
    { _id: input.targetId, userId: input.userId },
    {
      $set: {
        [setPath]: variants
      }
    },
    { new: true }
  );
}

export async function processWardrobeImageVariant(
  userId: string,
  itemOrUploadId: string,
  slot: ImageSlot,
  originalImage?: any,
  options: { targetType?: ProcessingTargetType; studioBackgroundPreset?: string } = {}
) {
  if (!supportedSlots.has(slot)) {
    return {
      ok: false,
      status: "failed" as const,
      safeMessage: "Unsupported image slot."
    };
  }

  const targetType = options.targetType || "upload";
  const target = targetType === "item"
    ? await WardrobeItem.findOne({ _id: itemOrUploadId, userId })
    : await WardrobeUpload.findOne({ _id: itemOrUploadId, userId });

  if (!target) {
    return {
      ok: false,
      status: "failed" as const,
      safeMessage: "Image target was not found."
    };
  }

  const image = originalImage || (target.images as any)?.[slot];
  const preset = getStudioBackgroundPreset(options.studioBackgroundPreset);
  const original = originalVariant(image);

  const cutout = await createTransparentCutout({
    userId,
    targetId: itemOrUploadId,
    slot,
    originalImage: image,
    studioBackgroundPreset: preset.id
  });
  const cutoutVariant = cutout.ok && cutout.image
    ? cutout.image
    : unavailableVariant("", cutout.safeMessage || "Background removal unavailable.");
  const studio = await applyFitPickStudioBackground(cutout, {
    userId,
    targetId: itemOrUploadId,
    slot,
    originalImage: image,
    studioBackgroundPreset: preset.id
  });
  const studioVariant = studio.ok && studio.image
    ? studio.image
    : unavailableVariant(preset.id, studio.safeMessage || "Studio image unavailable.");

  const variants = {
    ...(image?.variants || {}),
    original,
    cutout: cutoutVariant,
    studio: studioVariant
  };

  await updateTarget({ userId, targetId: itemOrUploadId, targetType, slot, originalImage: image, studioBackgroundPreset: preset.id }, variants);
  const ok = cutoutVariant.status === "ready" || studioVariant.status === "ready";
  const status = studioVariant.status === "ready" || cutoutVariant.status === "ready"
    ? "ready"
    : cutout.status === "failed" || studio.status === "failed"
      ? "failed"
      : "unavailable";

  return {
    ok,
    status,
    safeMessage: ok
      ? "Studio image variants created."
      : "Studio image processing is unavailable. Original image remains available.",
    image: imageWithVariants(image, variants),
    variants
  };
}

export function serializeProcessedImageVariants(result: any) {
  return {
    ok: Boolean(result?.ok),
    status: result?.status || "unavailable",
    safeMessage: result?.safeMessage || "",
    variants: result?.variants || {},
    image: result?.image || null
  };
}
