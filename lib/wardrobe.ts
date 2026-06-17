import mongoose from "mongoose";
import type { WardrobeCategory } from "@/types/wardrobe";

export function isObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

export function inferCondition(input: {
  category?: string;
  color?: string;
  occasions?: string[];
  condition?: "ready" | "needs-care" | "missing-tags";
}) {
  if (input.condition === "needs-care") return "needs-care";

  const hasMinimumTags = Boolean(input.category && input.color && input.occasions?.length);
  return hasMinimumTags ? "ready" : "missing-tags";
}

export function serializeWardrobeItem(item: any) {
  return {
    id: String(item._id),
    name: item.name,
    category: item.category,
    subcategory: item.subcategory || "",
    color: item.color || "",
    pattern: item.pattern || "",
    fabric: item.fabric || "",
    fit: item.fit || "",
    formality: item.formality || [],
    occasions: item.occasions || [],
    weather: item.weather || [],
    condition: item.condition,
    lastWornAt: item.lastWornAt ? new Date(item.lastWornAt).toISOString() : null,
    archivedAt: item.archivedAt ? new Date(item.archivedAt).toISOString() : null,
    thumbnailUrl: item.thumbnailUrl || "",
    hasImage: Boolean(item.storageKey || item.thumbnailUrl)
  };
}

export function serializeWardrobeUpload(upload: any) {
  return {
    id: String(upload._id),
    filename: upload.filename || "",
    mimeType: upload.mimeType || "",
    sizeBytes: upload.sizeBytes || 0,
    width: upload.width || 0,
    height: upload.height || 0,
    storageKey: upload.storageKey,
    uploadStatus: upload.uploadStatus,
    aiTagStatus: upload.aiTagStatus,
    suggestedTags: upload.suggestedTags || {},
    reviewedAt: upload.reviewedAt ? new Date(upload.reviewedAt).toISOString() : null,
    createdItemId: upload.createdItemId ? String(upload.createdItemId) : null
  };
}

export function wardrobeSummary(items: any[]) {
  const countsByCategory: Record<string, number> = {};

  for (const item of items) {
    countsByCategory[item.category] = (countsByCategory[item.category] || 0) + 1;
  }

  const required: Array<{ key: WardrobeCategory; label: string }> = [
    { key: "tops", label: "Add tops to build everyday outfits." },
    { key: "bottoms", label: "Add bottoms to complete outfit combinations." },
    { key: "shoes", label: "Add shoes for stronger recommendations." },
    { key: "native", label: "Add native or traditional wear for cultural occasions." },
    { key: "accessories", label: "Add accessories for polished finish options." }
  ];

  return {
    totalCount: items.length,
    readyCount: items.filter((item) => item.condition === "ready").length,
    needsCareCount: items.filter((item) => item.condition === "needs-care").length,
    missingTagsCount: items.filter((item) => item.condition === "missing-tags").length,
    countsByCategory,
    missingEssentials: required
      .filter((essential) => !countsByCategory[essential.key])
      .map((essential) => essential.label)
  };
}
