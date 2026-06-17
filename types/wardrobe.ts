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
  condition: WardrobeCondition;
  lastWorn?: string;
  archivedAt?: string | null;
  thumbnailUrl?: string;
  imageTone: string;
};

export type WardrobeSummary = {
  totalCount: number;
  readyCount: number;
  needsCareCount: number;
  missingTagsCount: number;
  countsByCategory: Record<string, number>;
  missingEssentials: string[];
};
