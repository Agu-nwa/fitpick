import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import type { SafeUser } from "@/types/auth";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: "" },
    timezone: { type: String, default: "" },
    locale: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    plan: { type: String, enum: ["free", "plus"], default: "free", index: true },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User =
  (mongoose.models.User as Model<UserDocument>) ||
  mongoose.model<UserDocument>("User", UserSchema);

export function toSafeUser(user: UserDocument): SafeUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || undefined,
    timezone: user.timezone || undefined,
    locale: user.locale || undefined,
    role: user.role,
    plan: user.plan,
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString()
  };
}
