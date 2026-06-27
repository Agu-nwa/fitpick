import type { WardrobeCategory, WardrobeCondition } from "@/types/wardrobe";
import type { WardrobeAiAnalysis } from "@/lib/ai/schemas/wardrobe-ai.schema";

export type AiTaggingProvider = "mock" | "gemini" | "openai";

export type AiSuggestedWardrobeTags = {
  name?: string;
  category?: WardrobeCategory;
  subcategory?: string;
  color?: string;
  pattern?: string;
  fabric?: string;
  fit?: string;
  formality?: string[];
  occasions?: string[];
  weather?: string[];
  condition?: WardrobeCondition;
  confidence: number;
  needsReview: boolean;
};

export type AiTaggingInput = {
  uploadId: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  images?: {
    front?: WardrobeImageAsset;
    back?: WardrobeImageAsset;
    fabricCloseUp?: WardrobeImageAsset;
    label?: WardrobeImageAsset;
    additional?: WardrobeImageAsset[];
  };
  suggestedTags?: Record<string, unknown>;
};

export type AiTaggingResult = {
  ok: boolean;
  provider: AiTaggingProvider;
  aiTagStatus: "completed" | "failed" | "needs-review";
  suggestedTags?: AiSuggestedWardrobeTags;
  aiAnalysis?: WardrobeAiAnalysis;
  confidence?: number;
  safeMessage?: string;
};

export type WardrobeImagePurpose = "front" | "back" | "fabricCloseUp" | "label" | "additional";

export type WardrobeImageVariantStatus = "not_started" | "processing" | "ready" | "failed" | "unavailable";

export type WardrobeImageVariant = {
  url?: string;
  storageKey?: string;
  provider?: string;
  width?: number;
  height?: number;
  bytes?: number;
  status?: WardrobeImageVariantStatus;
  backgroundPreset?: string;
  processedAt?: string;
  errorMessage?: string;
};

export type WardrobeImageAsset = {
  url: string;
  storageKey: string;
  provider: string;
  uploadedAt?: string;
  purpose: WardrobeImagePurpose;
  variants?: {
    original?: WardrobeImageVariant;
    cutout?: WardrobeImageVariant;
    studio?: WardrobeImageVariant;
    thumbnail?: WardrobeImageVariant;
  };
};
