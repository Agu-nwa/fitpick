import { runAvatarPreviewGenerationJob, serializeAvatarPreview } from "@/lib/avatar/avatar-preview";
import type { FitEvaluation } from "@/lib/fit/fit-lock";
import { getPreviewAccuracyLevel, type PreviewAccuracyLevelId } from "@/lib/preview/preview-accuracy";

export type TryOnProviderType =
  | "internal_preview"
  | "pictofit"
  | "clo_pipeline"
  | "browzwear_pipeline"
  | "custom"
  | "none";

export type TryOnDesiredView = "front" | "back" | "side" | "walking" | "360";

export type TryOnPreviewInput = {
  userId: string;
  avatarProfileId?: string;
  avatarMeasurements?: Record<string, unknown>;
  outfitRecommendationId?: string;
  wardrobeItemIds: string[];
  garmentAssets?: unknown[];
  garmentMeasurements?: Record<string, unknown>[];
  fitLockConstraints?: string | FitEvaluation;
  desiredView?: TryOnDesiredView;
  accuracyLevelRequested?: PreviewAccuracyLevelId;
  cacheKey?: string;
};

export type TryOnProviderOutput = {
  status: "queued" | "processing" | "ready" | "failed" | "provider_unavailable";
  provider: TryOnProviderType;
  previewUrls: string[];
  animationUrl?: string | null;
  modelUrl?: string | null;
  accuracyLevel: ReturnType<typeof getPreviewAccuracyLevel>;
  warnings: string[];
  jobId?: string | null;
};

export interface TryOnProvider {
  type: TryOnProviderType;
  generateTryOnPreview(input: TryOnPreviewInput): Promise<TryOnProviderOutput>;
  generateGarmentMesh(input: TryOnPreviewInput): Promise<TryOnProviderOutput>;
  generateAnimatedAvatarTryOn(input: TryOnPreviewInput): Promise<TryOnProviderOutput>;
  getTryOnJobStatus(jobId: string): Promise<TryOnProviderOutput>;
}

function unavailable(provider: TryOnProviderType, message = "True 3D garment simulation provider is not configured yet."): TryOnProviderOutput {
  return {
    status: "provider_unavailable",
    provider,
    previewUrls: [],
    animationUrl: null,
    modelUrl: null,
    accuracyLevel: getPreviewAccuracyLevel("garment_referenced"),
    warnings: [message]
  };
}

export function getConfiguredTryOnProviderType(): TryOnProviderType {
  const configured = (process.env.TRYON_PROVIDER || "internal_preview").trim() as TryOnProviderType;
  if (["internal_preview", "pictofit", "clo_pipeline", "browzwear_pipeline", "custom", "none"].includes(configured)) {
    return configured;
  }
  return "internal_preview";
}

export function getTryOnProvider(providerType: TryOnProviderType = getConfiguredTryOnProviderType()): TryOnProvider {
  return {
    type: providerType,
    async generateTryOnPreview(input) {
      if (providerType !== "internal_preview") return unavailable(providerType);
      if (!input.outfitRecommendationId || !input.avatarProfileId) {
        return {
          ...unavailable(providerType, "Internal preview needs an outfit recommendation and avatar profile."),
          status: "failed"
        };
      }

      const result = await runAvatarPreviewGenerationJob({
        userId: input.userId,
        outfitId: input.outfitRecommendationId,
        avatarProfileId: input.avatarProfileId,
        posePreset: input.desiredView === "walking" ? "walking" : input.desiredView === "side" ? "side" : input.desiredView === "back" ? "back" : undefined,
        cacheKey: input.cacheKey
      });
      const preview = serializeAvatarPreview({ ...(result.preview as any), cached: result.cached });

      return {
        status: preview.status === "ready" ? "ready" : "processing",
        provider: "internal_preview",
        previewUrls: preview.imageUrl ? [preview.imageUrl] : [],
        animationUrl: null,
        modelUrl: null,
        accuracyLevel: preview.accuracyLevel || getPreviewAccuracyLevel("garment_referenced"),
        warnings: preview.fitWarnings || []
      };
    },
    async generateGarmentMesh() {
      return unavailable(providerType, "Garment mesh generation requires a configured CLO, Browzwear, PICTOFiT-style, or custom simulation provider.");
    },
    async generateAnimatedAvatarTryOn(input) {
      if (providerType === "internal_preview") {
        return this.generateTryOnPreview({ ...input, desiredView: input.desiredView || "360" });
      }
      return unavailable(providerType);
    },
    async getTryOnJobStatus() {
      return unavailable(providerType, "External try-on job status is unavailable until a simulation provider is configured.");
    }
  };
}
