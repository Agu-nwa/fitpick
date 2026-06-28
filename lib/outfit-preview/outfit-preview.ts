import { createCacheKey } from "@/lib/ai/cache/ai-cache";
import { getAiModel } from "@/lib/ai/models/registry";
import { errorCategory, logAiEvent } from "@/lib/ai/observability/ai-logger";
import { openai } from "@/lib/ai/openai";
import { buildImagePreviewPrompt } from "@/lib/ai/prompts";
import { sanitizeUserPrompt } from "@/lib/ai/safety/ai-safety";
import { getPreviewAccuracyLevel } from "@/lib/preview/preview-accuracy";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { OutfitPreview } from "@/models/OutfitPreview";
import { WardrobeItem } from "@/models/WardrobeItem";

export const previewPromptVersion = "fitpick-image-preview-v2";

type PreviewStyle = "flat_lay" | "mannequin" | "lifestyle_editorial" | "luxury_lookbook";

type PreviewOptions = {
  style?: PreviewStyle;
  regenerate?: boolean;
};

function itemFingerprint(item: any) {
  return {
    id: String(item._id),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : "",
    name: item.name || "",
    category: item.category || "",
    color: item.color || "",
    pattern: item.pattern || "",
    fabric: item.fabric || "",
    fit: item.fit || "",
    verifiedMetadata: item.verifiedMetadata || {}
  };
}

function selectedItemDetails(items: any[]) {
  return items
    .map((item) => {
      const verified = item.verifiedMetadata || {};
      const verifiedText = Object.entries(verified)
        .slice(0, 12)
        .map(([key, field]: [string, any]) => `${key}: ${Array.isArray(field?.value) ? field.value.join(", ") : field?.value || "unknown"}`)
        .join("; ");

      return [
        `Item ID: ${String(item._id)}`,
        `Name: ${item.name || "unknown"}`,
        `Category: ${item.category || "unknown"}`,
        `Subcategory: ${item.subcategory || "unknown"}`,
        `Color: ${item.color || "unknown"}`,
        `Pattern: ${item.pattern || "unknown"}`,
        `Fabric: ${item.fabric || "unknown"}`,
        `Fit: ${item.fit || "unknown"}`,
        verifiedText ? `Verified metadata: ${verifiedText}` : ""
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function buildOutfitPreviewCacheKey(userId: string, outfitId: string, itemIds: string[], styleOptions: PreviewOptions = {}) {
  return createCacheKey("outfit-preview", {
    userId,
    outfitId,
    itemIds: itemIds.map(String).sort(),
    model: getAiModel("imageGeneration"),
    promptVersion: previewPromptVersion,
    style: styleOptions.style || "flat_lay"
  });
}

export async function getCachedOutfitPreview(userId: string, outfitId: string, cacheKey: string) {
  return OutfitPreview.findOne({
    userId,
    outfitId,
    cacheKey,
    status: "ready",
    imageUrl: { $ne: "" }
  }).lean();
}

export async function generateOutfitPreview(userId: string, outfit: any, items: any[], options: PreviewOptions = {}) {
  const model = getAiModel("imageGeneration");
  const startedAt = Date.now();
  const style = options.style || "flat_lay";
  const prompt = buildImagePreviewPrompt({
    outfitDescription: selectedItemDetails(items),
    occasion: sanitizeUserPrompt(outfit.occasion || "Today"),
    style
  });

  try {
    const image = await openai.images.generate({
      model,
      prompt,
      size: "1024x1024"
    });

    const b64 = image.data?.[0]?.b64_json;
    if (!b64) throw new Error("image_generation_empty");

    logAiEvent({
      operation: "outfit-preview-generate",
      model,
      latencyMs: Date.now() - startedAt,
      status: "success",
      cacheHit: false,
      provider: "openai"
    });

    return {
      base64: b64,
      contentType: "image/png",
      format: "png" as const,
      width: 1024,
      height: 1024,
      model,
      promptVersion: previewPromptVersion,
      style
    };
  } catch (error) {
    logAiEvent({
      operation: "outfit-preview-generate",
      model,
      latencyMs: Date.now() - startedAt,
      status: "failed",
      cacheHit: false,
      provider: "openai",
      errorCategory: errorCategory(error)
    });
    throw error;
  }
}

export async function saveGeneratedPreview(userId: string, outfitId: string, generatedImage: any, cacheKey: string) {
  const uploaded = await uploadGeneratedImage(generatedImage.base64, {
    userId,
    outfitId,
    cacheKey,
    contentType: generatedImage.contentType,
    format: generatedImage.format,
    width: generatedImage.width,
    height: generatedImage.height
  });

  const previewPatch = {
    status: "ready",
    provider: uploaded.provider,
    storageKey: uploaded.storageKey,
    imageUrl: uploaded.url,
    cacheKey,
    promptVersion: generatedImage.promptVersion,
    model: generatedImage.model,
    accuracyLevel: "garment_referenced",
    generatedAt: new Date(),
    errorMessage: "",
    lastAttemptAt: new Date()
  };

  await OutfitRecommendation.findOneAndUpdate(
    { _id: outfitId, userId },
    {
      $set: { preview: previewPatch }
    }
  );

  return OutfitPreview.findOneAndUpdate(
    { userId, outfitId, cacheKey },
    {
      $set: {
        userId,
        outfitId,
        cacheKey,
        storageKey: uploaded.storageKey,
        imageUrl: uploaded.url,
        provider: uploaded.provider,
        status: "ready",
        promptVersion: generatedImage.promptVersion,
        model: generatedImage.model,
        accuracyLevel: "garment_referenced",
        generatedAt: previewPatch.generatedAt,
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
        bytes: uploaded.bytes,
        errorMessage: "",
        lastAttemptAt: previewPatch.lastAttemptAt
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export function serializeOutfitPreview(preview: any) {
  const accuracyLevel = getPreviewAccuracyLevel(preview?.accuracyLevel || "garment_referenced");
  return {
    id: preview?._id ? String(preview._id) : "",
    status: preview?.status || "not_started",
    provider: preview?.provider || "",
    storageKey: preview?.storageKey || "",
    imageUrl: preview?.imageUrl || "",
    previewUrl: preview?.imageUrl || "",
    cacheKey: preview?.cacheKey || "",
    promptVersion: preview?.promptVersion || "",
    model: preview?.model || "",
    accuracyLevel,
    fitWarnings: preview?.fitWarnings || [],
    generatedAt: preview?.generatedAt ? new Date(preview.generatedAt).toISOString() : null,
    errorMessage: preview?.errorMessage || "",
    attempts: preview?.attempts || 0,
    cached: Boolean(preview?.cached),
    visualizationNote: `${accuracyLevel.label}: ${accuracyLevel.meaning} Not an exact virtual try-on.`
  };
}

export function buildPreviewCacheKeyFromItems(userId: string, outfitId: string, items: any[], options: PreviewOptions = {}) {
  return buildOutfitPreviewCacheKey(
    userId,
    outfitId,
    items.map((item) => JSON.stringify(itemFingerprint(item))),
    options
  );
}

export async function loadOwnedPreviewSubject(userId: string, outfitId: string) {
  const outfit = await OutfitRecommendation.findOne({ _id: outfitId, userId });
  if (!outfit) return null;

  const itemIds = (outfit.itemIds || []).map(String);
  const items = await WardrobeItem.find({
    _id: { $in: itemIds },
    userId,
    archivedAt: null
  }).lean();

  return {
    outfit,
    items,
    missingItems: items.length !== itemIds.length || !items.length
  };
}

export async function runOutfitPreviewGenerationJob(input: {
  userId: string;
  outfitId: string;
  style?: PreviewStyle;
  cacheKey?: string;
}) {
  const loaded = await loadOwnedPreviewSubject(input.userId, input.outfitId);
  if (!loaded) throw new Error("Outfit was not found.");
  if (loaded.missingItems) throw new Error("Preview requires all owned outfit items.");

  const cacheKey = input.cacheKey || buildPreviewCacheKeyFromItems(input.userId, input.outfitId, loaded.items, { style: input.style || "flat_lay" });
  const cached = await getCachedOutfitPreview(input.userId, input.outfitId, cacheKey);
  if (cached) return { preview: cached, cached: true };

  const generated = await generateOutfitPreview(input.userId, loaded.outfit, loaded.items, { style: input.style || "flat_lay" });
  const preview = await saveGeneratedPreview(input.userId, input.outfitId, generated, cacheKey);
  return { preview, cached: false };
}
