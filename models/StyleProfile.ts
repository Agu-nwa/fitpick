import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const StyleProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    favoriteColors: { type: [String], default: [] },
    dislikedColors: { type: [String], default: [] },
    favoriteBrands: { type: [String], default: [] },
    dislikedBrands: { type: [String], default: [] },
    preferredFits: { type: [String], default: [] },
    dislikedFits: { type: [String], default: [] },
    preferredFormality: { type: Number, default: null, min: 0, max: 10 },
    preferredOccasions: { type: [String], default: [] },
    culturalStylePreferences: { type: [String], default: [] },
    preferredCategories: { type: [String], default: [] },
    avoidedCategories: { type: [String], default: [] },
    fashionRiskLevel: { type: String, enum: ["conservative", "balanced", "expressive"], default: "balanced" },
    comfortPriority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    luxuryPreference: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    notes: { type: [String], default: [] },
    inferredFrom: { type: [String], default: [] }
  },
  { timestamps: true }
);

export type StyleProfileDocument = InferSchemaType<typeof StyleProfileSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StyleProfile =
  (mongoose.models.StyleProfile as Model<StyleProfileDocument>) ||
  mongoose.model<StyleProfileDocument>("StyleProfile", StyleProfileSchema);
