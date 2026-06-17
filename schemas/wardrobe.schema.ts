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

export const uploadMetadataSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.enum(allowedMimeTypes),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  width: z.number().int().positive().max(12000).optional(),
  height: z.number().int().positive().max(12000).optional(),
  suggestedTags: z.record(z.unknown()).optional()
});

export const uploadTagReviewSchema = createWardrobeItemSchema.extend({
  uploadId: objectId.optional()
});
