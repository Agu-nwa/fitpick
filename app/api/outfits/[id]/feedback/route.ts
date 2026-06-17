export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { readJson, validateBody } from "@/lib/validation";
import { isObjectId } from "@/lib/wardrobe";
import { OutfitFeedback } from "@/models/OutfitFeedback";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { outfitFeedbackSchema } from "@/schemas/outfit.schema";

type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `outfit-feedback:${meta.ip}`, limit: 40, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Outfit was not found.");

    const parsed = validateBody(outfitFeedbackSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const outfit = await OutfitRecommendation.findOne({ _id: context.params.id, userId: auth.user._id }).lean();
    if (!outfit) return apiError("NOT_FOUND", "Outfit was not found.");

    const feedback = await OutfitFeedback.create({
      userId: auth.user._id,
      outfitId: outfit._id,
      rating: parsed.data.rating,
      feedbackTags: parsed.data.feedbackTags || [],
      note: parsed.data.note || ""
    });

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "outfit.feedback",
      entityType: "OutfitFeedback",
      entityId: String(feedback._id)
    });

    return apiSuccess(
      {
        feedback: {
          id: String(feedback._id),
          outfitId: String(feedback.outfitId),
          rating: feedback.rating,
          feedbackTags: feedback.feedbackTags,
          note: feedback.note,
          createdAt: feedback.createdAt?.toISOString()
        }
      },
      { message: "Feedback recorded.", status: 201 }
    );
  } catch (error) {
    console.error("FitPick outfit feedback error:", error);
    return apiError("INTERNAL_ERROR", "Unable to record outfit feedback right now.");
  }
}
