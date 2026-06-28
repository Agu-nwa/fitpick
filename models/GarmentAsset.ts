import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const assetTypes = [
  "image_cutout",
  "texture_reference",
  "flat_lay",
  "mesh_2d_pattern",
  "mesh_3d_garment",
  "simulation_ready"
] as const;

const imageVariants = ["original", "cutout", "studio", "fabric", "label"] as const;
const simulationProviders = ["internal", "clo", "browzwear", "pictofit", "custom", "none"] as const;
const simulationStatuses = ["not_ready", "processing", "ready", "failed"] as const;
const accuracyLevels = ["inspired_visualization", "garment_referenced", "fit_locked", "true_3d_simulation"] as const;

const GarmentAssetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    wardrobeItemId: { type: Schema.Types.ObjectId, ref: "WardrobeItem", required: true, index: true },
    assetType: { type: String, enum: assetTypes, required: true, index: true },
    sourceImageVariant: { type: String, enum: imageVariants, default: "original" },
    storageKey: { type: String, default: "", maxlength: 512 },
    imageUrl: { type: String, default: "", maxlength: 2048 },
    meshStorageKey: { type: String, default: "", maxlength: 512 },
    textureStorageKey: { type: String, default: "", maxlength: 512 },
    measurements: { type: Schema.Types.Mixed, default: {} },
    simulationProvider: { type: String, enum: simulationProviders, default: "none" },
    simulationStatus: { type: String, enum: simulationStatuses, default: "not_ready", index: true },
    accuracyLevel: { type: String, enum: accuracyLevels, default: "garment_referenced" }
  },
  { timestamps: true }
);

GarmentAssetSchema.index({ userId: 1, wardrobeItemId: 1 });
GarmentAssetSchema.index({ userId: 1, wardrobeItemId: 1, assetType: 1, sourceImageVariant: 1 }, { unique: true });
GarmentAssetSchema.index({ simulationStatus: 1, updatedAt: 1 });

export type GarmentAssetDocument = InferSchemaType<typeof GarmentAssetSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const GarmentAsset =
  (mongoose.models.GarmentAsset as Model<GarmentAssetDocument>) ||
  mongoose.model<GarmentAssetDocument>("GarmentAsset", GarmentAssetSchema);
