export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { readJson, validateBody } from "@/lib/validation";
import { inferCondition, serializeWardrobeItem, wardrobeSummary } from "@/lib/wardrobe";
import { WardrobeItem } from "@/models/WardrobeItem";
import { createWardrobeItemSchema, wardrobeFiltersSchema } from "@/schemas/wardrobe.schema";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const filters = validateBody(
      wardrobeFiltersSchema,
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!filters.ok) return filters.response;

    const query: Record<string, unknown> = { userId: auth.user._id };

    if (filters.data.category) query.category = filters.data.category;
    if (filters.data.color) query.color = filters.data.color;
    if (filters.data.condition) query.condition = filters.data.condition;
    if (filters.data.occasion) query.occasions = filters.data.occasion;
    if (filters.data.weather) query.weather = filters.data.weather;
    if (filters.data.archived === "true") {
      query.archivedAt = { $ne: null };
    } else {
      query.archivedAt = null;
    }

    const items = await WardrobeItem.find(query).sort({ updatedAt: -1 }).lean();
    const serialized = items.map(serializeWardrobeItem);

    return apiSuccess({
      items: serialized,
      summary: wardrobeSummary(items)
    });
  } catch (error) {
    console.error("FitPick wardrobe list error:", error);
    return apiError("INTERNAL_ERROR", "Unable to load wardrobe right now.");
  }
}

export async function POST(request: NextRequest) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-create:${meta.ip}`, limit: 30, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(createWardrobeItemSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const condition = inferCondition(parsed.data);
    const item = await WardrobeItem.create({
      ...parsed.data,
      condition,
      archivedAt: null,
      userId: auth.user._id
    });

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "wardrobe.create",
      entityType: "WardrobeItem",
      entityId: String(item._id)
    });

    return apiSuccess({ item: serializeWardrobeItem(item) }, { message: "Wardrobe item created.", status: 201 });
  } catch (error) {
    console.error("FitPick wardrobe create error:", error);
    return apiError("INTERNAL_ERROR", "Unable to create wardrobe item right now.");
  }
}
