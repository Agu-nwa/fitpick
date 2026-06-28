export type WardrobeCondition = "ready" | "needs-care" | "missing-tags";
export type WardrobeCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "native"
  | "outerwear"
  | "shoes"
  | "bags"
  | "accessories";

import type { WardrobeImageAsset } from "@/types/ai-tagging";

export type TaggedSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "custom" | "unknown";
export type SizeSystem = "US" | "UK" | "EU" | "NG" | "international" | "custom" | "unknown";
export type GarmentFit = "slim" | "regular" | "relaxed" | "oversized" | "tailored" | "flowing" | "unknown";
export type StretchLevel = "none" | "low" | "medium" | "high" | "unknown";
export type FabricDrape = "structured" | "soft" | "flowing" | "heavy" | "stiff" | "unknown";
export type MeasurementSource = "label_ocr" | "user_confirmed" | "ai_estimated" | "manual" | "unknown";

export type GarmentMeasurements = {
  chestWidthCm?: number | null;
  shoulderWidthCm?: number | null;
  sleeveLengthCm?: number | null;
  bodyLengthCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  inseamCm?: number | null;
  outseamCm?: number | null;
  shoeLengthCm?: number | null;
  heelHeightCm?: number | null;
};

export type WardrobeItem = {
  id: string;
  name: string;
  category: WardrobeCategory;
  subcategory?: string;
  color: string;
  pattern?: string;
  fabric?: string;
  fit?: string;
  taggedSize?: TaggedSize;
  sizeSystem?: SizeSystem;
  garmentFit?: GarmentFit;
  garmentMeasurements?: GarmentMeasurements;
  stretchLevel?: StretchLevel;
  fabricDrape?: FabricDrape;
  fitConfidence?: number;
  measurementSource?: MeasurementSource;
  formality: string[];
  occasions: string[];
  weather: string[];
  verifiedMetadata?: Record<string, unknown>;
  condition: WardrobeCondition;
  lastWorn?: string;
  lastWornAt?: string | null;
  archivedAt?: string | null;
  imageUrl?: string;
  thumbnailUrl?: string;
  images?: Partial<Record<"front" | "back" | "fabricCloseUp" | "label", WardrobeImageAsset>> & {
    additional?: WardrobeImageAsset[];
  };
  aiAnalysis?: unknown;
  hasImage?: boolean;
  imageTone?: string;
  studioImageUrl?: string;
  recognizedEntity?: string;
  imageProcessingStatus?: "not_started" | "processing" | "ready" | "failed" | "unavailable" | string;
};

export type WardrobeSummary = {
  totalCount: number;
  readyCount: number;
  needsCareCount: number;
  missingTagsCount: number;
  countsByCategory: Record<string, number>;
  missingEssentials: string[];
};
