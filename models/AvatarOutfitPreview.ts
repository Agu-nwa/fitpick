import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AvatarOutfitPreviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    outfitId: { type: Schema.Types.ObjectId, ref: "OutfitRecommendation", required: true, index: true },
    avatarProfileId: { type: Schema.Types.ObjectId, ref: "AvatarProfile", required: true, index: true },
    itemIds: { type: [{ type: Schema.Types.ObjectId, ref: "WardrobeItem" }], default: [] },
    status: {
      type: String,
      enum: ["not_started", "generating", "ready", "failed"],
      default: "not_started",
      index: true
    },
    provider: { type: String, enum: ["s3"], default: "s3" },
    storageKey: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    cacheKey: { type: String, required: true, index: true },
    promptVersion: { type: String, default: "" },
    model: { type: String, default: "" },
    visualizationStyle: { type: String, enum: ["minimal", "luxury", "streetwear", "editorial"], default: "luxury" },
    posePreset: { type: String, enum: ["standing", "walking", "editorial", "runway", "casual", "side", "back"], default: "standing" },
    accuracyLevel: { type: String, enum: ["inspired_visualization", "garment_referenced", "fit_locked", "true_3d_simulation"], default: "inspired_visualization" },
    fitStatus: {
      type: String,
      enum: ["unknown", "likely_fits", "may_be_tight", "may_be_loose", "oversized_intended", "measurements_needed"],
      default: "unknown"
    },
    fitConfidence: { type: Number, default: 0, min: 0, max: 1 },
    fitWarnings: { type: [String], default: [] },
    fitLockInstructions: { type: [String], default: [] },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    generatedAt: { type: Date, default: null },
    errorMessage: { type: String, default: "", maxlength: 240 },
    format: { type: String, default: "png" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 }
  },
  { timestamps: true }
);

AvatarOutfitPreviewSchema.index({ userId: 1, outfitId: 1 });
AvatarOutfitPreviewSchema.index({ userId: 1, cacheKey: 1 }, { unique: true });
AvatarOutfitPreviewSchema.index({ status: 1, updatedAt: 1 });

export type AvatarOutfitPreviewDocument = InferSchemaType<typeof AvatarOutfitPreviewSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AvatarOutfitPreview =
  (mongoose.models.AvatarOutfitPreview as Model<AvatarOutfitPreviewDocument>) ||
  mongoose.model<AvatarOutfitPreviewDocument>("AvatarOutfitPreview", AvatarOutfitPreviewSchema);
