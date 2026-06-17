import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const WardrobeUploadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storageKey: { type: String, required: true },
    filename: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    sizeBytes: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    provider: { type: String, default: "metadata" },
    imageUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    uploadStatus: { type: String, enum: ["pending", "uploaded", "failed"], default: "pending" },
    aiTagStatus: { type: String, enum: ["not_started", "queued", "suggested", "reviewed", "failed"], default: "not_started" },
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
