export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { validateBody } from "@/lib/validation";
import { SavedLook } from "@/models/SavedLook";
import { WornLook } from "@/models/WornLook";
import { looksQuerySchema } from "@/schemas/outfit.schema";

function serializeSaved(look: any) {
  return {
    id: String(look._id),
    outfitId: String(look.outfitId),
    title: look.title,
    occasion: look.occasion,
    itemIds: (look.itemIds || []).map(String),
    favorite: Boolean(look.favorite),
    savedAt: look.savedAt ? new Date(look.savedAt).toISOString() : null
  };
}

function serializeWorn(look: any) {
  return {
    id: String(look._id),
    outfitId: String(look.outfitId),
    occasion: look.occasion,
    itemIds: (look.itemIds || []).map(String),
    wornAt: look.wornAt ? new Date(look.wornAt).toISOString() : null,
    rating: look.rating || "",
    repeatWarning: look.wornAt && (Date.now() - new Date(look.wornAt).getTime()) / 86_400_000 < 7
      ? "Worn recently"
      : ""
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(looksQuerySchema, Object.fromEntries(request.nextUrl.searchParams.entries()));
    if (!parsed.ok) return parsed.response;

    const tab = parsed.data.tab || "all";
    const limit = parsed.data.limit || 20;
    const baseQuery: Record<string, unknown> = { userId: auth.user._id };
    if (parsed.data.occasion) baseQuery.occasion = parsed.data.occasion;
    if (parsed.data.cursor) baseQuery._id = { $lt: parsed.data.cursor };

    const [saved, worn, favorites] = await Promise.all([
      tab === "worn" ? [] : SavedLook.find(baseQuery).sort({ savedAt: -1 }).limit(limit).lean(),
      tab === "saved" || tab === "favorites" ? [] : WornLook.find(baseQuery).sort({ wornAt: -1 }).limit(limit).lean(),
      tab === "worn" ? [] : SavedLook.find({ ...baseQuery, favorite: true }).sort({ savedAt: -1 }).limit(limit).lean()
    ]);

    return apiSuccess({
      saved: saved.map(serializeSaved),
      worn: worn.map(serializeWorn),
      favorites: favorites.map(serializeSaved),
      counts: {
        saved: saved.length,
        worn: worn.length,
        favorites: favorites.length
      }
    });
  } catch (error) {
    console.error("FitPick looks error:", error);
    return apiError("INTERNAL_ERROR", "Unable to load looks right now.");
  }
}
