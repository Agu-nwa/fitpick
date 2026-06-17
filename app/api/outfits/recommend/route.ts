export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { buildRecommendation, serializeOutfit } from "@/lib/recommendation/engine";
import { canCreateOutfitPick, incrementDailyPickUsage } from "@/lib/usage-limits";
import { readJson, validateBody } from "@/lib/validation";
import { Occasion } from "@/models/Occasion";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { StylePreference } from "@/models/StylePreference";
import { WardrobeItem } from "@/models/WardrobeItem";
import { WornLook } from "@/models/WornLook";
import { outfitRecommendationRequestSchema } from "@/schemas/outfit.schema";

export async function POST(request: NextRequest) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `outfit-recommend:${meta.ip}`, limit: 20, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(outfitRecommendationRequestSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const usageGate = await canCreateOutfitPick(String(auth.user._id));
    if (!usageGate.allowed) {
      return apiError("PLUS_REQUIRED", "You have used today’s free outfit picks. FitPick Plus unlocks more outfit options.", {
        details: {
          feature: "unlimited_outfit_picks",
          upgradePath: "/plus",
          usageToday: usageGate.usageToday,
          remainingDailyPicks: usageGate.remainingDailyPicks
        }
      });
    }

    const [preferences, wardrobeItems, wornLooks, occasion] = await Promise.all([
      StylePreference.findOne({ userId: auth.user._id }).lean(),
      WardrobeItem.find({ userId: auth.user._id, archivedAt: null }).lean(),
      WornLook.find({ userId: auth.user._id }).sort({ wornAt: -1 }).limit(25).lean(),
      parsed.data.occasionId
        ? Occasion.findOne({
            _id: parsed.data.occasionId,
            $or: [{ isGlobal: true }, { userId: auth.user._id }]
          }).lean()
        : null
    ]);

    if (!wardrobeItems.length) {
      return apiError("BAD_REQUEST", "Add wardrobe items before requesting an outfit.");
    }

    const occasionName = parsed.data.customOccasion?.name || parsed.data.occasionName || occasion?.name || "Today";
    const built = buildRecommendation({
      occasionName,
      occasionGroup: parsed.data.customOccasion?.group || occasion?.group,
      formality: parsed.data.formality || parsed.data.customOccasion?.formality || occasion?.formality || preferences?.formality,
      weatherContext: parsed.data.weatherContext,
      allowNeedsCare: parsed.data.allowNeedsCare,
      styleDirection: parsed.data.styleDirection,
      preferences,
      wardrobeItems,
      wornLooks
    });

    const recommendation = await OutfitRecommendation.create({
      userId: auth.user._id,
      occasionId: occasion?._id,
      title: built.title,
      occasion: built.occasion,
      itemIds: built.items.map((item: any) => item._id),
      confidence: built.confidence,
      reasonChips: built.reasonChips,
      summary: built.summary,
      weatherContext: built.weatherContext,
      repetitionNote: built.repetitionNote,
      careNote: built.careNote,
      colorNote: built.colorNote,
      swapGroups: built.swapGroups,
      source: "rule_based"
    });

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "outfit.recommend",
      entityType: "OutfitRecommendation",
      entityId: String(recommendation._id)
    });

    await incrementDailyPickUsage(String(auth.user._id));

    return apiSuccess(
      { outfit: serializeOutfit(recommendation, built.items) },
      { message: "Outfit recommendation created.", status: 201 }
    );
  } catch (error) {
    console.error("FitPick recommend outfit error:", error);
    return apiError("INTERNAL_ERROR", "Unable to create an outfit recommendation right now.");
  }
}
