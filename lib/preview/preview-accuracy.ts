export type PreviewAccuracyLevelId =
  | "inspired_visualization"
  | "garment_referenced"
  | "fit_locked"
  | "true_3d_simulation";

export type PreviewAccuracyLevel = {
  id: PreviewAccuracyLevelId;
  label: string;
  meaning: string;
  rank: 1 | 2 | 3 | 4;
};

export const previewAccuracyLevels: Record<PreviewAccuracyLevelId, PreviewAccuracyLevel> = {
  inspired_visualization: {
    id: "inspired_visualization",
    label: "AI Visualization",
    meaning: "Looks inspired by selected items but may not match exact garment fit.",
    rank: 1
  },
  garment_referenced: {
    id: "garment_referenced",
    label: "Garment-Referenced Preview",
    meaning: "Uses actual wardrobe item images as visual references but not guaranteed exact fit.",
    rank: 2
  },
  fit_locked: {
    id: "fit_locked",
    label: "Fit-Locked Preview",
    meaning: "Uses avatar measurements and garment fit metadata to reduce random fit changes.",
    rank: 3
  },
  true_3d_simulation: {
    id: "true_3d_simulation",
    label: "True 3D Garment Simulation",
    meaning: "Uses 3D garment assets/mesh and body measurements for real simulation.",
    rank: 4
  }
};

export function getPreviewAccuracyLevel(id?: string | null) {
  return previewAccuracyLevels[(id || "") as PreviewAccuracyLevelId] || previewAccuracyLevels.inspired_visualization;
}

export function resolvePreviewAccuracyLevel(input: {
  hasWardrobeImageReferences?: boolean;
  hasAvatarMeasurements?: boolean;
  hasGarmentFitMetadata?: boolean;
  hasGarmentMeasurements?: boolean;
  hasSimulationReadyAssets?: boolean;
  requestedLevel?: PreviewAccuracyLevelId | string | null;
}) {
  if (input.hasSimulationReadyAssets && input.requestedLevel === "true_3d_simulation") {
    return previewAccuracyLevels.true_3d_simulation;
  }

  if (input.hasAvatarMeasurements && input.hasGarmentFitMetadata && input.hasGarmentMeasurements) {
    return previewAccuracyLevels.fit_locked;
  }

  if (input.hasWardrobeImageReferences) {
    return previewAccuracyLevels.garment_referenced;
  }

  return previewAccuracyLevels.inspired_visualization;
}

export function previewAccuracyWarning(levelId?: string | null) {
  const level = getPreviewAccuracyLevel(levelId);
  if (level.id === "true_3d_simulation") return "";
  return `${level.label}: ${level.meaning} This is not exact virtual try-on.`;
}
