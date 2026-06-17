import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const BillingEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, default: "stripe_placeholder" },
    eventType: { type: String, required: true, index: true },
    status: { type: String, default: "placeholder" },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type BillingEventDocument = InferSchemaType<typeof BillingEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BillingEvent =
  (mongoose.models.BillingEvent as Model<BillingEventDocument>) ||
  mongoose.model<BillingEventDocument>("BillingEvent", BillingEventSchema);
