import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const WardrobeImageSchema = new Schema(
  {
    url: { type: String, default: "" },
    storageKey: { type: String, default: "" },
    provider: { type: String, default: "metadata" },
    uploadedAt: { type: Date, default: Date.now },
    purpose: {
      type: String,
      enum: ["front", "back", "fabricCloseUp", "label", "additional"],
      required: true
    }
  },
  { _id: false }
);

const WardrobeUploadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storageKey: { type: String, default: "" },
    filename: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    sizeBytes: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    provider: { type: String, default: "metadata" },
    imageUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    images: {
      front: { type: WardrobeImageSchema },
      back: { type: WardrobeImageSchema },
      fabricCloseUp: { type: WardrobeImageSchema },
      label: { type: WardrobeImageSchema },
      additional: { type: [WardrobeImageSchema], default: [] }
    },
    uploadStatus: { type: String, enum: ["pending", "uploaded", "failed"], default: "pending" },
    aiTagStatus: {
      type: String,
      enum: ["not_started", "queued", "suggested", "completed", "needs-review", "reviewed", "failed"],
      default: "not_started"
    },
    aiProvider: { type: String, default: "" },
    aiConfidence: { type: Number, default: 0 },
    aiErrorSafeMessage: { type: String, default: "" },
    aiAnalysis: { type: Schema.Types.Mixed, default: null },
    suggestedTags: { type: Schema.Types.Mixed, default: {} },
    reviewedAt: { type: Date },
    createdItemId: { type: Schema.Types.ObjectId, ref: "WardrobeItem" }
  },
  { timestamps: true }
);

export type WardrobeUploadDocument = InferSchemaType<typeof WardrobeUploadSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WardrobeUpload =
  (mongoose.models.WardrobeUpload as Model<WardrobeUploadDocument>) ||
  mongoose.model<WardrobeUploadDocument>("WardrobeUpload", WardrobeUploadSchema);
