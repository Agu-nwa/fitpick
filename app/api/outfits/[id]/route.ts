export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { serializeOutfit } from "@/lib/recommendation/engine";
import { isObjectId } from "@/lib/wardrobe";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { WardrobeItem } from "@/models/WardrobeItem";

type RouteContext = { params: { id: string } };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Outfit was not found.");

    const outfit = await OutfitRecommendation.findOne({ _id: context.params.id, userId: auth.user._id }).lean();
    if (!outfit) return apiError("NOT_FOUND", "Outfit was not found.");

    const items = await WardrobeItem.find({ _id: { $in: outfit.itemIds }, userId: auth.user._id }).lean();

    return apiSuccess({ outfit: serializeOutfit(outfit, items) });
  } catch (error) {
    console.error("FitPick outfit detail error:", error);
    return apiError("INTERNAL_ERROR", "Unable to load outfit right now.");
  }
}
