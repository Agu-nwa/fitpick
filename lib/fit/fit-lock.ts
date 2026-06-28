import { getPreviewAccuracyLevel as getAccuracyLevel, resolvePreviewAccuracyLevel, type PreviewAccuracyLevelId } from "@/lib/preview/preview-accuracy";

export type FitStatus =
  | "unknown"
  | "likely_fits"
  | "may_be_tight"
  | "may_be_loose"
  | "oversized_intended"
  | "measurements_needed";

export type FitEvaluation = {
  fitStatus: FitStatus;
  fitConfidence: number;
  warnings: string[];
  lockedFitInstructions: string[];
  accuracyLevel: ReturnType<typeof getAccuracyLevel>;
};

const measurementKeys = [
  "heightCm",
  "weightKg",
  "chestCm",
  "bustCm",
  "waistCm",
  "hipsCm",
  "shoulderWidthCm",
  "inseamCm",
  "armLengthCm",
  "neckCm",
  "thighCm"
] as const;

const garmentMeasurementKeys = [
  "chestWidthCm",
  "shoulderWidthCm",
  "sleeveLengthCm",
  "bodyLengthCm",
  "waistCm",
  "hipsCm",
  "inseamCm",
  "outseamCm",
  "shoeLengthCm",
  "heelHeightCm"
] as const;

function clamp01(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function numeric(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function metadataValue(item: any, key: string) {
  return item?.verifiedMetadata?.[key]?.value ?? item?.aiAnalysis?.fields?.[key]?.value ?? item?.[key];
}

function hasImageReference(item: any) {
  const images = item?.images || {};
  return Boolean(
    item?.imageUrl ||
    item?.thumbnailUrl ||
    images.front?.url ||
    images.back?.url ||
    images.front?.variants?.cutout?.url ||
    images.front?.variants?.studio?.url ||
    images.back?.variants?.cutout?.url ||
    images.back?.variants?.studio?.url
  );
}

export function buildAvatarMeasurementProfile(avatarProfile: any = {}) {
  const measurements = Object.fromEntries(
    measurementKeys.map((key) => [key, numeric(avatarProfile?.[key])])
  );
  const presentKeys = Object.entries(measurements).filter(([, value]) => value !== null).map(([key]) => key);

  return {
    avatarProfileId: avatarProfile?._id ? String(avatarProfile._id) : avatarProfile?.id || "",
    measurements,
    presentKeys,
    missingCoreMeasurements: ["heightCm", "chestCm", "waistCm", "hipsCm"].filter((key) => measurements[key] === null),
    source: avatarProfile?.bodyMeasurementSource || "unknown",
    confidence: clamp01(avatarProfile?.bodyMeasurementConfidence),
    fitPreference: avatarProfile?.bodyFitPreference || "regular",
    hasCoreMeasurements: ["heightCm", "chestCm", "waistCm", "hipsCm"].every((key) => measurements[key] !== null)
  };
}

export function buildGarmentFitProfile(wardrobeItem: any = {}) {
  const measurements = Object.fromEntries(
    garmentMeasurementKeys.map((key) => [key, numeric(wardrobeItem?.garmentMeasurements?.[key])])
  );
  const size = wardrobeItem?.taggedSize || metadataValue(wardrobeItem, "taggedSize") || metadataValue(wardrobeItem, "size") || "unknown";
  const garmentFit = wardrobeItem?.garmentFit || metadataValue(wardrobeItem, "garmentFit") || metadataValue(wardrobeItem, "fit") || wardrobeItem?.fit || "unknown";
  const measurementSource = wardrobeItem?.measurementSource || "unknown";
  const presentMeasurementCount = Object.values(measurements).filter(Boolean).length;

  return {
    itemId: wardrobeItem?._id ? String(wardrobeItem._id) : wardrobeItem?.id || "",
    name: wardrobeItem?.name || "Wardrobe item",
    category: wardrobeItem?.category || "unknown",
    size: String(size || "unknown"),
    sizeSystem: wardrobeItem?.sizeSystem || "unknown",
    garmentFit: String(garmentFit || "unknown"),
    stretchLevel: wardrobeItem?.stretchLevel || "unknown",
    fabricDrape: wardrobeItem?.fabricDrape || "unknown",
    measurements,
    hasMeasurements: presentMeasurementCount > 0,
    hasFitMetadata: Boolean(size && size !== "unknown") || Boolean(garmentFit && garmentFit !== "unknown"),
    fitConfidence: clamp01(wardrobeItem?.fitConfidence),
    measurementSource,
    hasImageReference: hasImageReference(wardrobeItem)
  };
}

export function evaluateGarmentFitOnAvatar(avatarProfile: any, wardrobeItem: any): FitEvaluation {
  const avatar = buildAvatarMeasurementProfile(avatarProfile);
  const garment = buildGarmentFitProfile(wardrobeItem);
  const warnings = new Set<string>();
  const instructions = new Set<string>([
    "Preserve garment length.",
    "Preserve sleeve shape.",
    "Do not resize garment to ideal model fit.",
    "Preserve visible colors, patterns, fabric texture, and proportions."
  ]);

  if (!avatar.hasCoreMeasurements) {
    avatar.missingCoreMeasurements.forEach((key) => warnings.add(`Avatar ${key.replace("Cm", "")} measurement is missing.`));
  }

  if (!garment.size || garment.size === "unknown") warnings.add("Garment size is unknown, so fit may not be exact.");
  if (!garment.hasMeasurements) warnings.add("Garment measurements are missing, so fit remains estimated.");
  if (garment.measurementSource === "ai_estimated") warnings.add("AI-estimated measurements are not exact.");
  if (avatar.source === "estimated") warnings.add("Avatar measurements are estimated, not body scan data.");

  if (["oversized", "flowing", "relaxed"].includes(garment.garmentFit)) {
    instructions.add("Preserve looseness and intended oversized or flowing silhouette.");
  }

  if (garment.category === "native") {
    instructions.add("Preserve native wear flowing silhouette and traditional garment proportions.");
  }

  if (garment.category === "shoes") {
    instructions.add("Preserve shoe proportions.");
  }

  let fitStatus: FitStatus = "unknown";
  let confidence = Math.max(garment.fitConfidence, avatar.confidence * 0.65);

  if (!avatar.hasCoreMeasurements || (!garment.hasMeasurements && (!garment.size || garment.size === "unknown"))) {
    fitStatus = "measurements_needed";
    confidence = Math.min(confidence, 0.35);
  } else if (["oversized", "flowing"].includes(garment.garmentFit)) {
    fitStatus = "oversized_intended";
    confidence = Math.max(confidence, 0.62);
  } else {
    const avatarChest = numeric(avatar.measurements.chestCm) || numeric(avatar.measurements.bustCm);
    const garmentChest = numeric(garment.measurements.chestWidthCm);
    const chestCircumference = garmentChest ? garmentChest * 2 : null;
    const avatarWaist = numeric(avatar.measurements.waistCm);
    const garmentWaist = numeric(garment.measurements.waistCm);
    const chestEase = avatarChest && chestCircumference ? chestCircumference - avatarChest : null;
    const waistEase = avatarWaist && garmentWaist ? garmentWaist - avatarWaist : null;

    if ((chestEase !== null && chestEase < 4) || (waistEase !== null && waistEase < 2)) {
      fitStatus = "may_be_tight";
      confidence = Math.max(confidence, 0.58);
      warnings.add("Measured ease appears low; this garment may be tight.");
    } else if ((chestEase !== null && chestEase > 28) || (waistEase !== null && waistEase > 24)) {
      fitStatus = "may_be_loose";
      confidence = Math.max(confidence, 0.56);
      warnings.add("Measured ease appears high; this garment may look loose.");
    } else if (garment.hasFitMetadata || garment.hasMeasurements) {
      fitStatus = "likely_fits";
      confidence = Math.max(confidence, 0.64);
    }
  }

  const accuracyLevel = resolvePreviewAccuracyLevel({
    hasWardrobeImageReferences: garment.hasImageReference,
    hasAvatarMeasurements: avatar.hasCoreMeasurements,
    hasGarmentFitMetadata: garment.hasFitMetadata,
    hasGarmentMeasurements: garment.hasMeasurements,
    requestedLevel: fitStatus === "likely_fits" || fitStatus === "oversized_intended" ? "fit_locked" : undefined
  });

  return {
    fitStatus,
    fitConfidence: clamp01(confidence),
    warnings: Array.from(warnings).slice(0, 8),
    lockedFitInstructions: Array.from(instructions),
    accuracyLevel
  };
}

export function evaluateOutfitFitOnAvatar(avatarProfile: any, outfitItems: any[] = []): FitEvaluation {
  if (!outfitItems.length) {
    return {
      fitStatus: "measurements_needed",
      fitConfidence: 0,
      warnings: ["No owned wardrobe items were available for fit evaluation."],
      lockedFitInstructions: ["Do not claim exact fit."],
      accuracyLevel: getAccuracyLevel("inspired_visualization")
    };
  }

  const itemEvaluations = outfitItems.map((item) => evaluateGarmentFitOnAvatar(avatarProfile, item));
  const warnings = Array.from(new Set(itemEvaluations.flatMap((result) => result.warnings))).slice(0, 10);
  const instructions = Array.from(new Set(itemEvaluations.flatMap((result) => result.lockedFitInstructions)));
  const confidence = itemEvaluations.reduce((sum, result) => sum + result.fitConfidence, 0) / itemEvaluations.length;
  const statuses = itemEvaluations.map((result) => result.fitStatus);
  const fitStatus: FitStatus =
    statuses.includes("may_be_tight") ? "may_be_tight" :
    statuses.includes("may_be_loose") ? "may_be_loose" :
    statuses.includes("measurements_needed") ? "measurements_needed" :
    statuses.every((status) => status === "oversized_intended") ? "oversized_intended" :
    statuses.includes("likely_fits") ? "likely_fits" :
    "unknown";

  const accuracyLevel = resolvePreviewAccuracyLevel({
    hasWardrobeImageReferences: outfitItems.some(hasImageReference),
    hasAvatarMeasurements: buildAvatarMeasurementProfile(avatarProfile).hasCoreMeasurements,
    hasGarmentFitMetadata: outfitItems.some((item) => buildGarmentFitProfile(item).hasFitMetadata),
    hasGarmentMeasurements: outfitItems.some((item) => buildGarmentFitProfile(item).hasMeasurements),
    requestedLevel: "fit_locked" satisfies PreviewAccuracyLevelId
  });

  return {
    fitStatus,
    fitConfidence: clamp01(confidence),
    warnings,
    lockedFitInstructions: instructions,
    accuracyLevel
  };
}

export function generateFitWarnings(avatarProfile: any, outfitItems: any[] = []) {
  return evaluateOutfitFitOnAvatar(avatarProfile, outfitItems).warnings;
}

export function getPreviewAccuracyLevel(input: Parameters<typeof resolvePreviewAccuracyLevel>[0] | string | null | undefined) {
  if (typeof input === "string" || input === null || input === undefined) return getAccuracyLevel(input);
  return resolvePreviewAccuracyLevel(input);
}

export function buildFitLockPromptConstraints(input: {
  avatarProfile?: any;
  outfitItems?: any[];
  fitEvaluation?: FitEvaluation;
}) {
  const evaluation = input.fitEvaluation || evaluateOutfitFitOnAvatar(input.avatarProfile, input.outfitItems || []);
  return [
    `Preview accuracy level: ${evaluation.accuracyLevel.label} (${evaluation.accuracyLevel.id}).`,
    `Fit status: ${evaluation.fitStatus}.`,
    `Fit confidence: ${evaluation.fitConfidence.toFixed(2)}.`,
    evaluation.warnings.length ? `Fit warnings: ${evaluation.warnings.join(" | ")}` : "Fit warnings: none recorded.",
    "Fit-lock rules:",
    ...evaluation.lockedFitInstructions.map((rule) => `- ${rule}`),
    "- Do not idealize fit.",
    "- Do not convert loose garments into slim fit.",
    "- Do not change garment length randomly.",
    "- Never label this generated image as exact try-on unless true 3D simulation is active."
  ].join("\n");
}
