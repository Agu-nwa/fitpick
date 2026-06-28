export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/audit";
import { getOrCreateAvatarProfile, serializeAvatarProfile, updateAvatarProfile } from "@/lib/avatar/avatar-profile";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { logSafeError } from "@/lib/security/safe-log";
import { safeShortText } from "@/lib/validation/common";
import { readJson, validateBody } from "@/lib/validation";

const nullablePreset = (max = 60) => z.union([safeShortText(max), z.null()]).optional();
const nullableMeasurement = (min: number, max: number) => z.union([z.number().min(min).max(max), z.null()]).optional();

const avatarProfilePatchSchema = z
  .object({
    genderPresentation: z.enum(["masculine", "feminine", "neutral"]).optional(),
    bodyPreset: z.enum(["slim", "average", "athletic", "curvy", "plus"]).optional(),
    heightPreset: z.enum(["short", "average", "tall"]).nullable().optional(),
    skinTonePreset: nullablePreset(),
    hairStylePreset: nullablePreset(),
    posePreset: z.enum(["standing", "walking", "editorial", "runway", "casual", "side", "back"]).optional(),
    visualizationStyle: z.enum(["minimal", "luxury", "streetwear", "editorial"]).optional(),
    avatarProvider: z.enum(["ready_player_me", "fitpick_preset", "custom_glb"]).optional(),
    avatarUrl: z.union([z.string().trim().max(2048), z.null()]).optional(),
    heightCm: nullableMeasurement(90, 240),
    weightKg: nullableMeasurement(25, 260),
    chestCm: nullableMeasurement(45, 180),
    bustCm: nullableMeasurement(45, 180),
    waistCm: nullableMeasurement(40, 180),
    hipsCm: nullableMeasurement(45, 200),
    shoulderWidthCm: nullableMeasurement(25, 80),
    inseamCm: nullableMeasurement(35, 130),
    armLengthCm: nullableMeasurement(30, 110),
    neckCm: nullableMeasurement(20, 70),
    thighCm: nullableMeasurement(25, 110),
    shoeSize: z.union([z.string().trim().max(40), z.null()]).optional(),
    bodyMeasurementSource: z.enum(["manual", "estimated", "body_scan", "unknown"]).optional(),
    bodyMeasurementConfidence: z.number().min(0).max(1).optional(),
    bodyFitPreference: z.enum(["true_to_size", "slim", "regular", "relaxed", "oversized"]).optional(),
    consentAccepted: z.boolean().optional()
  })
  .strict();

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const profile = await getOrCreateAvatarProfile(auth.user._id);
    return apiSuccess({ profile: serializeAvatarProfile(profile) });
  } catch (error) {
    logSafeError("avatar-profile.get", error);
    return apiError("INTERNAL_ERROR", "Unable to load your Digital Human right now.");
  }
}

export async function PATCH(request: NextRequest) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `avatar-profile:patch:${meta.ip}`, limit: 30, windowMs: 60 * 1000, operation: "avatar-profile-patch" });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(avatarProfilePatchSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const profile = await updateAvatarProfile(auth.user._id, parsed.data);
    return apiSuccess({ profile: serializeAvatarProfile(profile) }, { message: "Digital Human saved." });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_avatar_url") {
      return apiError("VALIDATION_ERROR", "Use a secure HTTPS GLB avatar URL.");
    }
    logSafeError("avatar-profile.patch", error);
    return apiError("INTERNAL_ERROR", "Unable to save your Digital Human right now.");
  }
}
