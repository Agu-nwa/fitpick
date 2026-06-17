import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PrivacyPreferenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    photoStorageConsent: { type: Boolean, default: false },
    personalizedRecommendations: { type: Boolean, default: true },
    outfitHistoryEnabled: { type: Boolean, default: true },
    marketingNotifications: { type: Boolean, default: false },
    accountDeletionRequestedAt: { type: Date }
  },
  { timestamps: true }
);

export type PrivacyPreferenceDocument = InferSchemaType<typeof PrivacyPreferenceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PrivacyPreference =
  (mongoose.models.PrivacyPreference as Model<PrivacyPreferenceDocument>) ||
  mongoose.model<PrivacyPreferenceDocument>("PrivacyPreference", PrivacyPreferenceSchema);
