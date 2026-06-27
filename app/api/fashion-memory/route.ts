export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { getMemorySummary, recordFashionMemory, serializeMemorySummary } from "@/lib/fashion-memory/fashion-memory";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { readJson, validateBody } from "@/lib/validation";
import { isObjectId } from "@/lib/wardrobe";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { WardrobeItem } from "@/models/WardrobeItem";

const memoryEventSchema = z.object({
  type: z.enum([
    "outfit_liked",
    "outfit_disliked",
    "outfit_saved",
    "outfit_rejected",
    "item_worn",
    "item_favorited",
    "item_hidden",
    "recommendation_clicked",
    "stylist_feedback",
    "manual_preference"
  ]),
  itemIds: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  outfitId: z.string().trim().max(80).nullable().optional(),
  recommendationId: z.string().trim().max(80).nullable().optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  feedbackText: z.string().trim().max(500).nullable().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  source: z.enum(["outfit_ui", "stylist_chat", "wardrobe_detail", "recommendation_engine", "style_profile"])
});

async function assertOwnedReferences(userId: any, data: z.infer<typeof memoryEventSchema>) {
  const itemIds = Array.from(new Set(data.itemIds || []));
  const outfitId = data.outfitId || data.recommendationId || null;

  if (itemIds.some((id) => !isObjectId(id))) {
    return { ok: false as const, response: apiError("BAD_REQUEST", "One or more wardrobe items are invalid.") };
  }

  if (outfitId) {
    if (!isObjectId(outfitId)) return { ok: false as const, response: apiError("BAD_REQUEST", "Outfit reference is invalid.") };
    const outfit = await OutfitRecommendation.findOne({ _id: outfitId, userId }).lean();
    if (!outfit) return { ok: false as const, response: apiError("NOT_FOUND", "Outfit was not found.") };
  }

  if (itemIds.length) {
    const ownedCount = await WardrobeItem.countDocuments({ _id: { $in: itemIds }, userId, archivedAt: null });
    if (ownedCount !== itemIds.length) {
      return { ok: false as const, response: apiError("FORBIDDEN", "One or more wardrobe items are not available.") };
    }
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `fashion-memory:get:${meta.ip}`, limit: 60, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const summary = await getMemorySummary(auth.user._id);
    return apiSuccess({ summary: serializeMemorySummary(summary) });
  } catch {
    return apiError("INTERNAL_ERROR", "Unable to load fashion memory right now.");
  }
}

export async function POST(request: NextRequest) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `fashion-memory:post:${meta.ip}`, limit: 60, windowMs: 60 * 1000, operation: "fashion-memory-post" });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(memoryEventSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const ownership = await assertOwnedReferences(auth.user._id, parsed.data);
    if (!ownership.ok) return ownership.response;

    const memory = await recordFashionMemory(auth.user._id, parsed.data);
    const summary = await getMemorySummary(auth.user._id);

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "outfit.feedback",
      entityType: "FashionMemory",
      entityId: String(memory._id)
    });

    return apiSuccess(
      {
        memory: {
          id: String(memory._id),
          type: memory.type,
          createdAt: memory.createdAt ? new Date(memory.createdAt).toISOString() : null
        },
        summary: serializeMemorySummary(summary)
      },
      { message: "Fashion memory updated.", status: 201 }
    );
  } catch {
    return apiError("INTERNAL_ERROR", "Unable to save fashion memory right now.");
  }
}
