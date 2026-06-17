export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { readJson, validateBody } from "@/lib/validation";
import { inferCondition, isObjectId, serializeWardrobeItem } from "@/lib/wardrobe";
import { WardrobeItem } from "@/models/WardrobeItem";
import { updateWardrobeItemSchema } from "@/schemas/wardrobe.schema";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    const item = await WardrobeItem.findOne({ _id: context.params.id, userId: auth.user._id }).lean();
    if (!item) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    return apiSuccess({ item: serializeWardrobeItem(item) });
  } catch (error) {
    console.error("FitPick wardrobe detail error:", error);
    return apiError("INTERNAL_ERROR", "Unable to load wardrobe item right now.");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-update:${meta.ip}`, limit: 40, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    const parsed = validateBody(updateWardrobeItemSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const existing = await WardrobeItem.findOne({ _id: context.params.id, userId: auth.user._id });
    if (!existing) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    Object.assign(existing, parsed.data);
    existing.condition = inferCondition({
      category: existing.category,
      color: existing.color,
      occasions: existing.occasions,
      condition: parsed.data.condition
    });

    await existing.save();
    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "wardrobe.update",
      entityType: "WardrobeItem",
      entityId: String(existing._id)
    });

    return apiSuccess({ item: serializeWardrobeItem(existing) }, { message: "Wardrobe item updated." });
  } catch (error) {
    console.error("FitPick wardrobe update error:", error);
    return apiError("INTERNAL_ERROR", "Unable to update wardrobe item right now.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-delete:${meta.ip}`, limit: 20, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    const hardDelete = request.nextUrl.searchParams.get("hard") === "true";
    const item = await WardrobeItem.findOne({ _id: context.params.id, userId: auth.user._id });
    if (!item) return apiError("NOT_FOUND", "Wardrobe item was not found.");

    if (hardDelete) {
      await item.deleteOne();
      await recordAuditEvent({
        request,
        userId: String(auth.user._id),
        action: "wardrobe.delete",
        entityType: "WardrobeItem",
        entityId: context.params.id
      });

      return apiSuccess({ deleted: true, archived: false }, { message: "Wardrobe item deleted." });
    }

    item.archivedAt = new Date();
    await item.save();
    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "wardrobe.archive",
      entityType: "WardrobeItem",
      entityId: String(item._id)
    });

    return apiSuccess({ item: serializeWardrobeItem(item), archived: true }, { message: "Wardrobe item archived." });
  } catch (error) {
    console.error("FitPick wardrobe delete error:", error);
    return apiError("INTERNAL_ERROR", "Unable to archive wardrobe item right now.");
  }
}
