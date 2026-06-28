import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AvatarProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    genderPresentation: { type: String, enum: ["masculine", "feminine", "neutral"], default: "neutral" },
    bodyPreset: { type: String, enum: ["slim", "average", "athletic", "curvy", "plus"], default: "average" },
    heightPreset: { type: String, enum: ["short", "average", "tall", null], default: null },
    skinTonePreset: { type: String, default: null, maxlength: 60 },
    hairStylePreset: { type: String, default: null, maxlength: 60 },
    posePreset: { type: String, enum: ["standing", "walking", "editorial", "runway", "casual", "side", "back"], default: "standing" },
    visualizationStyle: { type: String, enum: ["minimal", "luxury", "streetwear", "editorial"], default: "luxury" },
    avatarProvider: { type: String, enum: ["ready_player_me", "fitpick_preset", "custom_glb"], default: "fitpick_preset" },
    avatarUrl: { type: String, default: null, maxlength: 2048 },
    glbStorageKey: { type: String, default: null, maxlength: 512 },
    heightCm: { type: Number, default: null, min: 90, max: 240 },
    weightKg: { type: Number, default: null, min: 25, max: 260 },
    chestCm: { type: Number, default: null, min: 45, max: 180 },
    bustCm: { type: Number, default: null, min: 45, max: 180 },
    waistCm: { type: Number, default: null, min: 40, max: 180 },
    hipsCm: { type: Number, default: null, min: 45, max: 200 },
    shoulderWidthCm: { type: Number, default: null, min: 25, max: 80 },
    inseamCm: { type: Number, default: null, min: 35, max: 130 },
    armLengthCm: { type: Number, default: null, min: 30, max: 110 },
    neckCm: { type: Number, default: null, min: 20, max: 70 },
    thighCm: { type: Number, default: null, min: 25, max: 110 },
    shoeSize: { type: String, default: "", maxlength: 40 },
    bodyMeasurementSource: { type: String, enum: ["manual", "estimated", "body_scan", "unknown"], default: "unknown" },
    bodyMeasurementConfidence: { type: Number, default: 0, min: 0, max: 1 },
    bodyFitPreference: { type: String, enum: ["true_to_size", "slim", "regular", "relaxed", "oversized"], default: "regular" },
    consentAccepted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export type AvatarProfileDocument = InferSchemaType<typeof AvatarProfileSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AvatarProfile =
  (mongoose.models.AvatarProfile as Model<AvatarProfileDocument>) ||
  mongoose.model<AvatarProfileDocument>("AvatarProfile", AvatarProfileSchema);
