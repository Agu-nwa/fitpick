import crypto from "crypto";
import { createCacheKey } from "@/lib/ai/cache/ai-cache";
import { getAiModel } from "@/lib/ai/models/registry";
import { errorCategory, logAiEvent } from "@/lib/ai/observability/ai-logger";
import { openai } from "@/lib/ai/openai";
import { buildAvatarPreviewPrompt } from "@/lib/ai/prompts";
import { sanitizeUserPrompt } from "@/lib/ai/safety/ai-safety";
import { buildAvatarPromptContext, getOrCreateAvatarProfile, type PosePreset, type VisualizationStyle } from "@/lib/avatar/avatar-profile";
import { buildFitLockPromptConstraints, evaluateOutfitFitOnAvatar } from "@/lib/fit/fit-lock";
import { getPreviewAccuracyLevel } from "@/lib/preview/preview-accuracy";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { AvatarOutfitPreview } from "@/models/AvatarOutfitPreview";
import { AvatarProfile } from "@/models/AvatarProfile";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { WardrobeItem } from "@/models/WardrobeItem";

export const avatarPreviewPromptVersion = "fitpick-avatar-preview-v2";

type AvatarPreviewOptions = {
  visualizationStyle?: VisualizationStyle;
  posePreset?: PosePreset;
  regenerate?: boolean;
  cacheKey?: string;
};

function safeList(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
}

function metadataValue(item: any, key: string) {
  return item.verifiedMetadata?.[key]?.value ?? item.aiAnalysis?.fields?.[key]?.value ?? item[key];
}

function itemFingerprint(item: any) {
  return {
    id: String(item._id),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : "",
    name: item.name || "",
    category: item.category || "",
    subcategory: item.subcategory || "",
    color: item.color || "",
    pattern: item.pattern || "",
    fabric: item.fabric || "",
    fit: item.fit || "",
    taggedSize: item.taggedSize || "unknown",
    sizeSystem: item.sizeSystem || "unknown",
    garmentFit: item.garmentFit || "unknown",
    garmentMeasurements: item.garmentMeasurements || {},
    stretchLevel: item.stretchLevel || "unknown",
    fabricDrape: item.fabricDrape || "unknown",
    fitConfidence: item.fitConfidence || 0,
    measurementSource: item.measurementSource || "unknown",
    verifiedMetadata: item.verifiedMetadata || {}
  };
}

function avatarFingerprint(profile: any, options: AvatarPreviewOptions = {}) {
  return {
    id: String(profile._id),
    updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : "",
    genderPresentation: profile.genderPresentation || "neutral",
    bodyPreset: profile.bodyPreset || "average",
    heightPreset: profile.heightPreset || null,
    skinTonePreset: profile.skinTonePreset || null,
    hairStylePreset: profile.hairStylePreset || null,
    posePreset: options.posePreset || profile.posePreset || "standing",
    visualizationStyle: options.visualizationStyle || profile.visualizationStyle || "luxury",
    avatarProvider: profile.avatarProvider || "fitpick_preset",
    avatarUrl: profile.avatarUrl || null,
    glbStorageKey: profile.glbStorageKey || null,
    heightCm: profile.heightCm || null,
    chestCm: profile.chestCm || null,
    bustCm: profile.bustCm || null,
    waistCm: profile.waistCm || null,
    hipsCm: profile.hipsCm || null,
    shoulderWidthCm: profile.shoulderWidthCm || null,
    inseamCm: profile.inseamCm || null,
    armLengthCm: profile.armLengthCm || null,
    shoeSize: profile.shoeSize || "",
    bodyMeasurementSource: profile.bodyMeasurementSource || "unknown",
    bodyMeasurementConfidence: profile.bodyMeasurementConfidence || 0,
    bodyFitPreference: profile.bodyFitPreference || "regular"
  };
}

function selectedItemDetails(items: any[]) {
  return items
    .map((item) => {
      const verifiedLines = [
        ["Garment type", metadataValue(item, "garmentType")],
        ["Primary color", metadataValue(item, "primaryColor") || item.color],
        ["Secondary colors", safeList(metadataValue(item, "secondaryColors")).join(", ")],
        ["Pattern", metadataValue(item, "pattern") || item.pattern],
        ["Fabric estimate", metadataValue(item, "fabricEstimate") || item.fabric],
        ["Fabric composition", metadataValue(item, "fabricComposition")],
        ["Tagged size", item.taggedSize || metadataValue(item, "taggedSize") || metadataValue(item, "size")],
        ["Size system", item.sizeSystem || metadataValue(item, "sizeSystem")],
        ["Fit", metadataValue(item, "fit") || item.fit],
        ["Garment fit", item.garmentFit || metadataValue(item, "garmentFit")],
        ["Stretch", item.stretchLevel],
        ["Fabric drape", item.fabricDrape],
        ["Measurement source", item.measurementSource],
        ["Silhouette", metadataValue(item, "silhouette")],
        ["Texture", metadataValue(item, "texture")],
        ["Length", metadataValue(item, "length")],
        ["Cultural relevance", metadataValue(item, "culturalTraditionalRelevance")]
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}: ${Array.isArray(value) ? value.join(", ") : value}`);

      return [
        `Item ID: ${String(item._id)}`,
        `Name: ${item.name || "unknown"}`,
        `Category: ${item.category || "unknown"}`,
        `Subcategory: ${item.subcategory || "unknown"}`,
        ...verifiedLines
      ].join("\n");
    })
    .join("\n\n");
}

function avatarStorageKey(userId: string, outfitId: string, avatarProfileId: string, cacheKey: string) {
  const hashPart = crypto.createHash("sha256").update(cacheKey).digest("hex").slice(0, 40);
  return `avatar-previews/${userId}/${outfitId}/${avatarProfileId}/${hashPart}.png`;
}

export function buildAvatarPreviewCacheKey(
  userId: string,
  outfitId: string,
  itemIds: string[],
  avatarProfile: any,
  options: AvatarPreviewOptions = {}
) {
  return createCacheKey("avatar-preview", {
    userId,
    outfitId,
    itemIds: itemIds.map(String).sort(),
    avatarProfile: avatarFingerprint(avatarProfile, options),
    model: getAiModel("imageGeneration"),
    promptVersion: avatarPreviewPromptVersion,
    visualizationStyle: options.visualizationStyle || avatarProfile.visualizationStyle || "luxury",
    posePreset: options.posePreset || avatarProfile.posePreset || "standing"
  });
}

export async function getCachedAvatarPreview(userId: string, outfitId: string, cacheKey: string) {
  return AvatarOutfitPreview.findOne({
    userId,
    outfitId,
    cacheKey,
    status: "ready",
    imageUrl: { $ne: "" }
  }).lean();
}

export async function loadOwnedAvatarPreviewSubject(userId: string, outfitId: string) {
  const outfit = await OutfitRecommendation.findOne({ _id: outfitId, userId });
  if (!outfit) return null;

  const itemIds = (outfit.itemIds || []).map(String);
  const items = await WardrobeItem.find({
    _id: { $in: itemIds },
    userId,
    archivedAt: null
  }).lean();

  const avatarProfile = await getOrCreateAvatarProfile(userId);

  return {
    outfit,
    items,
    avatarProfile,
    itemIds,
    missingItems: items.length !== itemIds.length || !items.length
  };
}

export async function markAvatarPreviewStatus(
  userId: string,
  outfitId: string,
  avatarProfileId: string,
  cacheKey: string,
  patch: Record<string, unknown>,
  incrementAttempt = false
) {
  const update: Record<string, unknown> = { $set: patch };
  if (incrementAttempt) update.$inc = { attempts: 1 };

  return AvatarOutfitPreview.findOneAndUpdate(
    { userId, outfitId, cacheKey },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function generateAvatarOutfitPreview(
  userId: string,
  outfit: any,
  items: any[],
  avatarProfile: any,
  options: AvatarPreviewOptions = {}
) {
  const model = getAiModel("imageGeneration");
  const startedAt = Date.now();
  const visualizationStyle = options.visualizationStyle || avatarProfile.visualizationStyle || "luxury";
  const posePreset = options.posePreset || avatarProfile.posePreset || "standing";
  const fitEvaluation = evaluateOutfitFitOnAvatar(avatarProfile, items);
  const fitLockConstraints = buildFitLockPromptConstraints({
    avatarProfile,
    outfitItems: items,
    fitEvaluation
  });
  const prompt = buildAvatarPreviewPrompt({
    outfitDescription: selectedItemDetails(items),
    occasion: sanitizeUserPrompt(outfit.occasion || "Today"),
    avatarContext: buildAvatarPromptContext({ ...avatarProfile.toObject?.(), ...avatarProfile, posePreset, visualizationStyle }),
    fitLockConstraints,
    previewAccuracyLabel: fitEvaluation.accuracyLevel.label,
    fitWarnings: fitEvaluation.warnings,
    visualizationStyle
  });

  try {
    const image = await openai.images.generate({
      model,
      prompt,
      size: "1024x1024"
    });

    const b64 = image.data?.[0]?.b64_json;
    if (!b64) throw new Error("avatar_image_generation_empty");

    logAiEvent({
      operation: "avatar-preview-generate",
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
      promptVersion: avatarPreviewPromptVersion,
      visualizationStyle,
      posePreset,
      accuracyLevel: fitEvaluation.accuracyLevel.id,
      fitStatus: fitEvaluation.fitStatus,
      fitConfidence: fitEvaluation.fitConfidence,
      fitWarnings: fitEvaluation.warnings,
      fitLockInstructions: fitEvaluation.lockedFitInstructions,
      cacheKey: options.cacheKey || buildAvatarPreviewCacheKey(userId, String(outfit._id), items.map((item) => JSON.stringify(itemFingerprint(item))), avatarProfile, options)
    };
  } catch (error) {
    logAiEvent({
      operation: "avatar-preview-generate",
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

export async function saveAvatarPreview(
  userId: string,
  outfitId: string,
  avatarProfileId: string,
  generatedImage: any,
  itemIds: string[],
  cacheKey = generatedImage.cacheKey
) {
  const storageKey = avatarStorageKey(userId, outfitId, avatarProfileId, cacheKey);
  const uploaded = await uploadGeneratedImage(generatedImage.base64, {
    userId,
    outfitId,
    cacheKey,
    storageKey,
    contentType: generatedImage.contentType,
    format: generatedImage.format,
    width: generatedImage.width,
    height: generatedImage.height
  });

  return AvatarOutfitPreview.findOneAndUpdate(
    { userId, outfitId, cacheKey },
    {
      $set: {
        userId,
        outfitId,
        avatarProfileId,
        itemIds,
        cacheKey,
        storageKey: uploaded.storageKey,
        imageUrl: uploaded.url,
        provider: "s3",
        status: "ready",
        promptVersion: generatedImage.promptVersion,
        model: generatedImage.model,
        visualizationStyle: generatedImage.visualizationStyle,
        posePreset: generatedImage.posePreset,
        accuracyLevel: generatedImage.accuracyLevel || "inspired_visualization",
        fitStatus: generatedImage.fitStatus || "unknown",
        fitConfidence: generatedImage.fitConfidence || 0,
        fitWarnings: generatedImage.fitWarnings || [],
        fitLockInstructions: generatedImage.fitLockInstructions || [],
        generatedAt: new Date(),
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
        bytes: uploaded.bytes,
        errorMessage: "",
        lastAttemptAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export function serializeAvatarPreview(preview: any) {
  const accuracyLevel = getPreviewAccuracyLevel(preview?.accuracyLevel);
  return {
    id: preview?._id ? String(preview._id) : "",
    status: preview?.status || "not_started",
    provider: preview?.provider || "s3",
    storageKey: preview?.storageKey || "",
    imageUrl: preview?.imageUrl || "",
    previewUrl: preview?.imageUrl || "",
    cacheKey: preview?.cacheKey || "",
    promptVersion: preview?.promptVersion || "",
    model: preview?.model || "",
    visualizationStyle: preview?.visualizationStyle || "luxury",
    posePreset: preview?.posePreset || "standing",
    accuracyLevel,
    fitStatus: preview?.fitStatus || "unknown",
    fitConfidence: typeof preview?.fitConfidence === "number" ? preview.fitConfidence : 0,
    fitWarnings: preview?.fitWarnings || [],
    fitLockInstructions: preview?.fitLockInstructions || [],
    generatedAt: preview?.generatedAt ? new Date(preview.generatedAt).toISOString() : null,
    errorMessage: preview?.errorMessage || "",
    attempts: preview?.attempts || 0,
    cached: Boolean(preview?.cached),
    visualizationNote: `${accuracyLevel.label}: ${accuracyLevel.meaning} Not exact virtual try-on.`
  };
}

export function buildAvatarCacheKeyFromItems(userId: string, outfitId: string, items: any[], avatarProfile: any, options: AvatarPreviewOptions = {}) {
  return buildAvatarPreviewCacheKey(
    userId,
    outfitId,
    items.map((item) => JSON.stringify(itemFingerprint(item))),
    avatarProfile,
    options
  );
}

export async function runAvatarPreviewGenerationJob(input: {
  userId: string;
  outfitId: string;
  avatarProfileId: string;
  visualizationStyle?: VisualizationStyle;
  posePreset?: PosePreset;
  cacheKey?: string;
}) {
  const loaded = await loadOwnedAvatarPreviewSubject(input.userId, input.outfitId);
  if (!loaded) throw new Error("Outfit was not found.");
  if (loaded.missingItems) throw new Error("Avatar preview requires all owned outfit items.");

  const avatarProfile = await AvatarProfile.findOne({ _id: input.avatarProfileId, userId: input.userId });
  if (!avatarProfile) throw new Error("Avatar profile was not found.");
  if (!avatarProfile.consentAccepted) throw new Error("Avatar visualization consent is required.");

  const options = {
    visualizationStyle: input.visualizationStyle || avatarProfile.visualizationStyle,
    posePreset: input.posePreset || avatarProfile.posePreset
  } as AvatarPreviewOptions;
  const cacheKey = input.cacheKey || buildAvatarCacheKeyFromItems(input.userId, input.outfitId, loaded.items, avatarProfile, options);
  const cached = await getCachedAvatarPreview(input.userId, input.outfitId, cacheKey);
  if (cached) return { preview: cached, cached: true };

  await markAvatarPreviewStatus(input.userId, input.outfitId, String(avatarProfile._id), cacheKey, {
    userId: input.userId,
    outfitId: input.outfitId,
    avatarProfileId: avatarProfile._id,
    itemIds: loaded.itemIds,
    status: "generating",
    provider: "s3",
    promptVersion: avatarPreviewPromptVersion,
    model: getAiModel("imageGeneration"),
    visualizationStyle: options.visualizationStyle,
    posePreset: options.posePreset,
    errorMessage: "",
    lastAttemptAt: new Date()
  });

  try {
    const generated = await generateAvatarOutfitPreview(input.userId, loaded.outfit, loaded.items, avatarProfile, { ...options, cacheKey });
    const preview = await saveAvatarPreview(input.userId, input.outfitId, String(avatarProfile._id), generated, loaded.itemIds, cacheKey);
    return { preview, cached: false };
  } catch (error) {
    await markAvatarPreviewStatus(input.userId, input.outfitId, String(avatarProfile._id), cacheKey, {
      status: "failed",
      errorMessage: "Unable to generate avatar preview right now.",
      lastAttemptAt: new Date()
    });
    throw error;
  }
}
