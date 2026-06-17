import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const OutfitFeedbackSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    outfitId: { type: Schema.Types.ObjectId, ref: "OutfitRecommendation", required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    feedbackTags: { type: [String], default: [] },
    note: { type: String, default: "", maxlength: 500 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type OutfitFeedbackDocument = InferSchemaType<typeof OutfitFeedbackSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OutfitFeedback =
  (mongoose.models.OutfitFeedback as Model<OutfitFeedbackDocument>) ||
  mongoose.model<OutfitFeedbackDocument>("OutfitFeedback", OutfitFeedbackSchema);
