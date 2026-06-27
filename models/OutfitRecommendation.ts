import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const OutfitRecommendationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    occasionId: { type: Schema.Types.ObjectId, ref: "Occasion" },
    title: { type: String, default: "" },
    occasion: { type: String, default: "" },
    itemIds: { type: [{ type: Schema.Types.ObjectId, ref: "WardrobeItem" }], default: [] },
    confidence: { type: String, enum: ["Strong match", "Good match", "Needs review"], default: "Needs review" },
    reasonChips: { type: [String], default: [] },
    summary: { type: String, default: "" },
    weatherContext: { type: String, default: "" },
    repetitionNote: { type: String, default: "" },
    careNote: { type: String, default: "" },
    colorNote: { type: String, default: "" },
    occasionFit: { type: String, default: "" },
    whyItWorks: { type: String, default: "" },
    materialNote: { type: String, default: "" },
    silhouetteNote: { type: String, default: "" },
    improvementNote: { type: String, default: "" },
    addLater: { type: String, default: "" },
    stylingTips: { type: [String], default: [] },
    confidenceScore: { type: Number, default: 0 },
    preview: {
      status: {
        type: String,
        enum: ["not_started", "generating", "ready", "failed"],
        default: "not_started"
      },
      provider: { type: String, default: "" },
      storageKey: { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      cacheKey: { type: String, default: "" },
      promptVersion: { type: String, default: "" },
      model: { type: String, default: "" },
      generatedAt: { type: Date, default: null },
      errorMessage: { type: String, default: "" },
      attempts: { type: Number, default: 0 },
      lastAttemptAt: { type: Date, default: null }
    },
    swapGroups: { type: Schema.Types.Mixed, default: [] },
    source: {
      type: String,
      enum: ["rule_based", "manual", "ai_placeholder", "ai", "outfit_page", "stylist_chat", "system"],
      default: "rule_based",
      index: true
    },
    requestText: { type: String, default: "", maxlength: 220 },
    reuseKey: { type: String, default: "", maxlength: 96, index: true },
    reasoningMetadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

OutfitRecommendationSchema.index({ userId: 1, occasion: 1 });
OutfitRecommendationSchema.index({ userId: 1, createdAt: -1 });
OutfitRecommendationSchema.index({ userId: 1, source: 1, reuseKey: 1 });

export type OutfitRecommendationDocument = InferSchemaType<typeof OutfitRecommendationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OutfitRecommendation =
  (mongoose.models.OutfitRecommendation as Model<OutfitRecommendationDocument>) ||
  mongoose.model<OutfitRecommendationDocument>("OutfitRecommendation", OutfitRecommendationSchema);
