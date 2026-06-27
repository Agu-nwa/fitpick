export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/audit";
import { isObjectId, serializeWardrobeUpload } from "@/lib/wardrobe";
import { WardrobeUpload } from "@/models/WardrobeUpload";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-upload-detail:${meta.ip}`, limit: 60, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Wardrobe upload was not found.");

    const upload = await WardrobeUpload.findOne({ _id: context.params.id, userId: auth.user._id });
    if (!upload) return apiError("NOT_FOUND", "Wardrobe upload was not found.");

    return apiSuccess({ upload: serializeWardrobeUpload(upload) });
  } catch (error) {
    console.error("FitPick wardrobe upload detail error:", error);
    return apiError("INTERNAL_ERROR", "Unable to load wardrobe upload right now.");
  }
}
