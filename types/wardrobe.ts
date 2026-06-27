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

export type WardrobeItem = {
  id: string;
  name: string;
  category: WardrobeCategory;
  subcategory?: string;
  color: string;
  pattern?: string;
  fabric?: string;
  fit?: string;
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
