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
    swapGroups: { type: Schema.Types.Mixed, default: [] },
    source: { type: String, enum: ["rule_based", "manual", "ai_placeholder"], default: "rule_based" }
  },
  { timestamps: true }
);

OutfitRecommendationSchema.index({ userId: 1, occasion: 1 });
OutfitRecommendationSchema.index({ userId: 1, createdAt: -1 });

export type OutfitRecommendationDocument = InferSchemaType<typeof OutfitRecommendationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OutfitRecommendation =
  (mongoose.models.OutfitRecommendation as Model<OutfitRecommendationDocument>) ||
  mongoose.model<OutfitRecommendationDocument>("OutfitRecommendation", OutfitRecommendationSchema);
