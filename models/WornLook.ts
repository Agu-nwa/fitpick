import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const WornLookSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    outfitId: { type: Schema.Types.ObjectId, ref: "OutfitRecommendation" },
    itemIds: { type: [{ type: Schema.Types.ObjectId, ref: "WardrobeItem" }], default: [] },
    occasion: { type: String, default: "" },
    wornAt: { type: Date, default: Date.now },
    rating: { type: String, enum: ["Perfect", "Good", "Okay", "Not today", "Not my style", ""], default: "" }
  },
  { timestamps: true }
);

WornLookSchema.index({ userId: 1, wornAt: -1 });
WornLookSchema.index({ userId: 1, occasion: 1 });

export type WornLookDocument = InferSchemaType<typeof WornLookSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WornLook =
  (mongoose.models.WornLook as Model<WornLookDocument>) ||
  mongoose.model<WornLookDocument>("WornLook", WornLookSchema);
