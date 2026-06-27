import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");

export const wardrobeIdSchema = z.object({
  id: objectId
});

export const wardrobeCategorySchema = z.enum([
  "tops",
  "bottoms",
  "dresses",
  "native",
  "outerwear",
  "shoes",
  "bags",
  "accessories"
]);

export const wardrobeConditionSchema = z.enum(["ready", "needs-care", "missing-tags"]);

const tagList = z.array(z.string().trim().min(1).max(40)).max(20);
const confirmedScalar = z.union([z.string().trim().max(500), z.number().min(0).max(10), z.null()]);
const confirmedList = z.array(z.string().trim().min(1).max(120)).max(30);
const confirmedFieldSchema = z
  .object({
    value: z.union([confirmedScalar, confirmedList]),
    confidence: z.number().min(0).max(1).optional(),
    originalConfidence: z.number().min(0).max(1).optional(),
    source: z.literal("user_confirmed")
  })
  .strict();

const wardrobeFields = {
  name: z.string().trim().min(1).max(120),
  category: wardrobeCategorySchema,
  subcategory: z.string().trim().max(80).optional().or(z.literal("")),
  color: z.string().trim().max(60).optional().or(z.literal("")),
  pattern: z.string().trim().max(60).optional().or(z.literal("")),
  fabric: z.string().trim().max(60).optional().or(z.literal("")),
  fit: z.string().trim().max(60).optional().or(z.literal("")),
  formality: tagList.default([]),
  occasions: tagList.default([]),
  weather: tagList.default([]),
  condition: wardrobeConditionSchema.optional()
};

export const createWardrobeItemSchema = z.object(wardrobeFields);

export const updateWardrobeItemSchema = z
  .object({
    ...wardrobeFields,
    name: wardrobeFields.name.optional(),
    category: wardrobeFields.category.optional(),
    formality: tagList.optional(),
    occasions: tagList.optional(),
    weather: tagList.optional()
  })
  .strict();

export const wardrobeTagReviewSchema = z
  .object({
    category: wardrobeCategorySchema.optional(),
    subcategory: z.string().trim().max(80).optional().or(z.literal("")),
    color: z.string().trim().max(60).optional().or(z.literal("")),
    pattern: z.string().trim().max(60).optional().or(z.literal("")),
    fabric: z.string().trim().max(60).optional().or(z.literal("")),
    fit: z.string().trim().max(60).optional().or(z.literal("")),
    formality: tagList.optional(),
    occasions: tagList.optional(),
    weather: tagList.optional(),
    condition: wardrobeConditionSchema.optional()
  })
  .strict();

export const wardrobeFiltersSchema = z.object({
  category: wardrobeCategorySchema.optional(),
  occasion: z.string().trim().max(60).optional(),
  color: z.string().trim().max(60).optional(),
  condition: wardrobeConditionSchema.optional(),
  weather: z.string().trim().max(60).optional(),
  archived: z.enum(["true", "false"]).optional()
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
] as const;

const imagePurposeSchema = z.enum(["front", "back", "fabricCloseUp", "label", "additional"]);

const wardrobeImageVariantSchema = z
  .object({
    url: z.string().trim().url().max(600).optional().or(z.literal("")),
    storageKey: z.string().trim().max(260).optional().or(z.literal("")),
    provider: z.enum(["local_placeholder", "metadata", "s3"]).default("s3"),
    width: z.number().int().nonnegative().max(12000).optional(),
    height: z.number().int().nonnegative().max(12000).optional(),
    bytes: z.number().int().nonnegative().max(20 * 1024 * 1024).optional(),
    status: z.enum(["not_started", "processing", "ready", "failed", "unavailable"]).optional(),
    backgroundPreset: z.string().trim().max(80).optional().or(z.literal("")),
    processedAt: z.string().datetime().optional(),
    errorMessage: z.string().trim().max(180).optional().or(z.literal(""))
  })
  .strict();

const wardrobeImageVariantsSchema = z
  .object({
    original: wardrobeImageVariantSchema.optional(),
    cutout: wardrobeImageVariantSchema.optional(),
    studio: wardrobeImageVariantSchema.optional(),
    thumbnail: wardrobeImageVariantSchema.optional()
  })
  .strict();

const wardrobeImageAssetSchema = z
  .object({
    url: z.string().trim().url().max(600),
    storageKey: z.string().trim().max(260),
    provider: z.enum(["local_placeholder", "metadata", "s3"]).default("metadata"),
    uploadedAt: z.string().datetime().optional(),
    purpose: imagePurposeSchema,
    variants: wardrobeImageVariantsSchema.optional()
  })
  .strict();

export const wardrobeImagesSchema = z
  .object({
    front: wardrobeImageAssetSchema.optional(),
    back: wardrobeImageAssetSchema.optional(),
    fabricCloseUp: wardrobeImageAssetSchema.optional(),
    label: wardrobeImageAssetSchema.optional(),
    additional: z.array(wardrobeImageAssetSchema).max(8).default([])
  })
  .strict();

export const uploadMetadataSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.enum(allowedMimeTypes),
  sizeBytes: z.number().int().positive().max(8 * 1024 * 1024),
  width: z.number().int().positive().max(12000).optional(),
  height: z.number().int().positive().max(12000).optional(),
  provider: z.enum(["s3", "local_placeholder", "metadata"]).optional(),
  storageKey: z.string().trim().max(260).optional(),
  publicId: z.string().trim().max(260).optional(),
  imageUrl: z.string().trim().url().max(600).optional(),
  secureUrl: z.string().trim().url().max(600).optional(),
  thumbnailUrl: z.string().trim().url().max(600).optional(),
  images: wardrobeImagesSchema.optional(),
  uploadStatus: z.enum(["pending", "uploaded", "failed"]).optional(),
  suggestedTags: z.record(z.unknown()).optional()
});

export const uploadTagReviewSchema = createWardrobeItemSchema.extend({
  uploadId: objectId.optional(),
  verifiedFields: z.record(confirmedFieldSchema).optional()
});
