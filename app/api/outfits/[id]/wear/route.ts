export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { readJson, validateBody } from "@/lib/validation";
import { isObjectId } from "@/lib/wardrobe";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { WardrobeItem } from "@/models/WardrobeItem";
import { WornLook } from "@/models/WornLook";
import { wearOutfitSchema } from "@/schemas/outfit.schema";

type RouteContext = { params: { id: string } };

function serializeWornLook(look: any) {
  return {
    id: String(look._id),
    outfitId: String(look.outfitId),
    itemIds: (look.itemIds || []).map(String),
    occasion: look.occasion,
    wornAt: look.wornAt ? new Date(look.wornAt).toISOString() : null,
    rating: look.rating || ""
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `outfit-wear:${meta.ip}`, limit: 30, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Outfit was not found.");

    const parsed = validateBody(wearOutfitSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const outfit = await OutfitRecommendation.findOne({ _id: context.params.id, userId: auth.user._id }).lean();
    if (!outfit) return apiError("NOT_FOUND", "Outfit was not found.");

    const wornAt = parsed.data.wornAt ? new Date(parsed.data.wornAt) : new Date();
    const look = await WornLook.create({
      userId: auth.user._id,
      outfitId: outfit._id,
      itemIds: outfit.itemIds,
      occasion: outfit.occasion,
      wornAt,
      rating: parsed.data.rating || ""
    });

    await WardrobeItem.updateMany(
      { _id: { $in: outfit.itemIds }, userId: auth.user._id },
      { $set: { lastWornAt: wornAt } }
    );

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "outfit.wear",
      entityType: "WornLook",
      entityId: String(look._id)
    });

    return apiSuccess({ look: serializeWornLook(look) }, { message: "Outfit marked as worn.", status: 201 });
  } catch (error) {
    console.error("FitPick wear outfit error:", error);
    return apiError("INTERNAL_ERROR", "Unable to mark outfit as worn right now.");
  }
}
