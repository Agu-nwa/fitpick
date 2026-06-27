import { z } from "zod";

export const allowedUploadMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
] as const;

export const signedUploadSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.enum(allowedUploadMimeTypes),
  sizeBytes: z.number().int().positive().max(8 * 1024 * 1024),
  purpose: z
    .enum([
      "wardrobe_original",
      "wardrobe_thumbnail",
      "wardrobe_front",
      "wardrobe_back",
      "wardrobe_fabricCloseUp",
      "wardrobe_label",
      "avatar"
    ])
    .default("wardrobe_original")
});
