import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const DailyUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    outfitPickCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

DailyUsageSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

export type DailyUsageDocument = InferSchemaType<typeof DailyUsageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DailyUsage =
  (mongoose.models.DailyUsage as Model<DailyUsageDocument>) ||
  mongoose.model<DailyUsageDocument>("DailyUsage", DailyUsageSchema);
