export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { buildSwappedPayload } from "@/lib/recommendation/swap";
import { readJson, validateBody } from "@/lib/validation";
import { isObjectId } from "@/lib/wardrobe";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { WardrobeItem } from "@/models/WardrobeItem";
import { swapOutfitSchema } from "@/schemas/outfit.schema";

type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `outfit-swap:${meta.ip}`, limit: 30, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Outfit was not found.");

    const parsed = validateBody(swapOutfitSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const outfit = await OutfitRecommendation.findOne({ _id: context.params.id, userId: auth.user._id });
    if (!outfit) return apiError("NOT_FOUND", "Outfit was not found.");

    const currentItems = await WardrobeItem.find({ _id: { $in: outfit.itemIds }, userId: auth.user._id });
    const itemToReplace = currentItems.find((item) => String(item._id) === parsed.data.itemIdToReplace);
    if (!itemToReplace) return apiError("NOT_FOUND", "Item to replace was not found in this outfit.");

    let replacement = parsed.data.replacementItemId
      ? await WardrobeItem.findOne({ _id: parsed.data.replacementItemId, userId: auth.user._id, archivedAt: null })
      : null;

    if (!replacement) {
      replacement = await WardrobeItem.findOne({
        userId: auth.user._id,
        archivedAt: null,
        _id: { $ne: itemToReplace._id },
        category: parsed.data.category || itemToReplace.category,
        condition: { $ne: "needs-care" }
      }).sort({ lastWornAt: 1, updatedAt: -1 });
    }

    if (!replacement) return apiError("NOT_FOUND", "No suitable replacement item was found.");

    const updatedItemIds = currentItems.map((item) =>
      String(item._id) === parsed.data.itemIdToReplace ? replacement!._id : item._id
    );
    outfit.itemIds = updatedItemIds as any;
    await outfit.save();

    const payload = buildSwappedPayload({
      outfit,
      currentItems,
      replacement,
      itemIdToReplace: parsed.data.itemIdToReplace,
      wardrobeItems: currentItems
    });

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "outfit.swap",
      entityType: "OutfitRecommendation",
      entityId: String(outfit._id)
    });

    return apiSuccess({ outfit: payload }, { message: "Outfit item swapped." });
  } catch (error) {
    console.error("FitPick outfit swap error:", error);
    return apiError("INTERNAL_ERROR", "Unable to swap outfit item right now.");
  }
}
