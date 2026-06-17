export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { readJson, validateBody } from "@/lib/validation";
import { inferCondition, isObjectId, serializeWardrobeItem } from "@/lib/wardrobe";
import { WardrobeItem } from "@/models/WardrobeItem";
import { wardrobeTagReviewSchema } from "@/schemas/wardrobe.schema";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-tags:${meta.ip}`, limit: 40, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    const parsed = validateBody(wardrobeTagReviewSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const item = await WardrobeItem.findOne({ _id: context.params.id, userId: auth.user._id });
    if (!item) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    Object.assign(item, parsed.data);
    item.condition = inferCondition({
      category: item.category,
      color: item.color,
      occasions: item.occasions,
      condition: parsed.data.condition
    });

    await item.save();
    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "wardrobe.tags.review",
      entityType: "WardrobeItem",
      entityId: String(item._id)
    });

    return apiSuccess({ item: serializeWardrobeItem(item) }, { message: "Wardrobe tags reviewed." });
  } catch (error) {
    console.error("FitPick wardrobe tag review error:", error);
    return apiError("INTERNAL_ERROR", "Unable to review wardrobe tags right now.");
  }
}
