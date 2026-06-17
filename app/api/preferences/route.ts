export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { readJson, validateBody } from "@/lib/validation";
import { StylePreference } from "@/models/StylePreference";
import { PrivacyPreference } from "@/models/PrivacyPreference";
import { stylePreferenceSchema } from "@/schemas/preference.schema";

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const [preferences, privacy] = await Promise.all([
      (await StylePreference.findOne({ userId: auth.user._id }).lean()) ||
        (await StylePreference.create({ userId: auth.user._id })),
      (await PrivacyPreference.findOne({ userId: auth.user._id }).lean()) ||
        (await PrivacyPreference.create({ userId: auth.user._id }))
    ]);

    return apiSuccess({ preferences, privacy });
  } catch (error) {
    console.error("FitPick preferences get error:", error);
    return apiError("INTERNAL_ERROR", "Unable to load preferences right now.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(stylePreferenceSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const { photoStorageConsent, personalizedRecommendations, outfitHistoryEnabled, marketingNotifications, ...styleData } = parsed.data;
    const privacyData = { photoStorageConsent, personalizedRecommendations, outfitHistoryEnabled, marketingNotifications };
    const cleanPrivacyData = Object.fromEntries(Object.entries(privacyData).filter(([, value]) => value !== undefined));

    const [preferences, privacy] = await Promise.all([
      StylePreference.findOneAndUpdate(
      { userId: auth.user._id },
        { $set: styleData },
      { new: true, upsert: true }
      ).lean(),
      Object.keys(cleanPrivacyData).length
        ? PrivacyPreference.findOneAndUpdate(
            { userId: auth.user._id },
            { $set: cleanPrivacyData },
            { new: true, upsert: true }
          ).lean()
        : PrivacyPreference.findOne({ userId: auth.user._id }).lean()
    ]);

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "preferences.update",
      entityType: "StylePreference",
      entityId: String(preferences?._id || "")
    });

    if (Object.keys(cleanPrivacyData).length) {
      await recordAuditEvent({
        request,
        userId: String(auth.user._id),
        action: "privacy.update",
        entityType: "PrivacyPreference",
        entityId: String(privacy?._id || "")
      });
    }

    return apiSuccess({ preferences, privacy }, { message: "Preferences updated." });
  } catch (error) {
    console.error("FitPick preferences patch error:", error);
    return apiError("INTERNAL_ERROR", "Unable to update preferences right now.");
  }
}
