import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ImageVariantSchema = new Schema(
  {
    url: { type: String, default: "" },
    storageKey: { type: String, default: "" },
    provider: { type: String, default: "s3" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    status: { type: String, enum: ["not_started", "processing", "ready", "failed", "unavailable"], default: "not_started" },
    backgroundPreset: { type: String, default: "" },
    processedAt: { type: Date, default: null },
    errorMessage: { type: String, default: "" }
  },
  { _id: false }
);

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
    },
    variants: {
      original: { type: ImageVariantSchema },
      cutout: { type: ImageVariantSchema },
      studio: { type: ImageVariantSchema },
      thumbnail: { type: ImageVariantSchema }
    }
  },
  { _id: false }
);

const WardrobeItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    storageKey: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    images: {
      front: { type: WardrobeImageSchema },
      back: { type: WardrobeImageSchema },
      fabricCloseUp: { type: WardrobeImageSchema },
      label: { type: WardrobeImageSchema },
      additional: { type: [WardrobeImageSchema], default: [] }
    },
    category: {
      type: String,
      enum: ["tops", "bottoms", "dresses", "native", "outerwear", "shoes", "bags", "accessories"],
      required: true
    },
    subcategory: { type: String, default: "" },
    color: { type: String, default: "" },
    pattern: { type: String, default: "" },
    fabric: { type: String, default: "" },
    fit: { type: String, default: "" },
    formality: { type: [String], default: [] },
    occasions: { type: [String], default: [] },
    weather: { type: [String], default: [] },
    verifiedMetadata: { type: Schema.Types.Mixed, default: {} },
    aiAnalysis: { type: Schema.Types.Mixed, default: null },
    condition: { type: String, enum: ["ready", "needs-care", "missing-tags"], default: "missing-tags" },
    lastWornAt: { type: Date },
    archivedAt: { type: Date }
  },
  { timestamps: true }
);

export type WardrobeItemDocument = InferSchemaType<typeof WardrobeItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WardrobeItem =
  (mongoose.models.WardrobeItem as Model<WardrobeItemDocument>) ||
  mongoose.model<WardrobeItemDocument>("WardrobeItem", WardrobeItemSchema);
