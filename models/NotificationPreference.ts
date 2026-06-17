import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const NotificationPreferenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    morningReminder: { type: Boolean, default: true },
    weatherAlerts: { type: Boolean, default: true },
    eventPrep: { type: Boolean, default: true },
    repeatWarnings: { type: Boolean, default: true },
    pushToken: { type: String, default: "" },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "" },
      end: { type: String, default: "" }
    },
    timezone: { type: String, default: "" }
  },
  { timestamps: true }
);

export type NotificationPreferenceDocument = InferSchemaType<typeof NotificationPreferenceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const NotificationPreference =
  (mongoose.models.NotificationPreference as Model<NotificationPreferenceDocument>) ||
  mongoose.model<NotificationPreferenceDocument>("NotificationPreference", NotificationPreferenceSchema);
