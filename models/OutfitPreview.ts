import mongoose, { Schema } from "mongoose";

const OutfitPreviewSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    outfitId: {
      type: Schema.Types.ObjectId,
      ref: "OutfitRecommendation",
      required: true
    },

    imageUrl: {
      type: String,
      default: ""
    },

    storageKey: {
      type: String,
      default: ""
    },

    cacheKey: {
      type: String,
      required: true,
      index: true
    },

    provider: {
      type: String,
      default: "s3"
    },

    status: {
      type: String,
      enum: ["not_started", "generating", "ready", "failed", "generated_not_persisted"],
      default: "not_started"
    },
    promptVersion: { type: String, default: "" },
    model: { type: String, default: "" },
    generatedAt: { type: Date, default: null },
    errorMessage: { type: String, default: "" },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    format: { type: String, default: "png" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

OutfitPreviewSchema.index({ userId: 1, outfitId: 1, cacheKey: 1 }, { unique: true });

export const OutfitPreview =
  mongoose.models.OutfitPreview ||
  mongoose.model(
    "OutfitPreview",
    OutfitPreviewSchema
  );
