export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { readJson, validateBody } from "@/lib/validation";
import {
  getOrCreateStyleProfile,
  inferStyleSignalsFromWardrobe,
  mergeStyleSignals,
  serializeStyleProfile,
  updateStyleProfile
} from "@/lib/style-profile/style-profile";
import { WardrobeItem } from "@/models/WardrobeItem";

const tagList = z.array(z.string().trim().min(1).max(60)).max(20);

const styleProfilePatchSchema = z
  .object({
    favoriteColors: tagList.optional(),
    dislikedColors: tagList.optional(),
    favoriteBrands: tagList.optional(),
    dislikedBrands: tagList.optional(),
    preferredFits: tagList.optional(),
    dislikedFits: tagList.optional(),
    preferredFormality: z.number().min(0).max(10).nullable().optional(),
    preferredOccasions: tagList.optional(),
    culturalStylePreferences: tagList.optional(),
    preferredCategories: tagList.optional(),
    avoidedCategories: tagList.optional(),
    fashionRiskLevel: z.enum(["conservative", "balanced", "expressive"]).optional(),
    comfortPriority: z.enum(["low", "medium", "high"]).optional(),
    luxuryPreference: z.enum(["low", "medium", "high"]).optional(),
    notes: z.array(z.string().trim().min(1).max(180)).max(20).optional()
  })
  .strict();

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const [profile, wardrobeItems] = await Promise.all([
      getOrCreateStyleProfile(auth.user._id),
      WardrobeItem.find({ userId: auth.user._id, archivedAt: null }).lean()
    ]);

    const inferred = mergeStyleSignals(profile, inferStyleSignalsFromWardrobe(wardrobeItems));
    const updated = Object.values(inferred).some((value) => Array.isArray(value) && value.length)
      ? await updateStyleProfile(auth.user._id, inferred)
      : profile;

    return apiSuccess({ profile: serializeStyleProfile(updated) });
  } catch (error) {
    console.error("FitPick style profile GET error:", error);
    return apiError("INTERNAL_ERROR", "Unable to load your Style DNA right now.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(styleProfilePatchSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const profile = await updateStyleProfile(auth.user._id, parsed.data);
    return apiSuccess({ profile: serializeStyleProfile(profile) }, { message: "Style DNA saved." });
  } catch (error) {
    console.error("FitPick style profile PATCH error:", error);
    return apiError("INTERNAL_ERROR", "Unable to save your Style DNA right now.");
  }
}
