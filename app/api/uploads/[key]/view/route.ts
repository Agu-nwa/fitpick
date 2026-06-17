export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { createSignedViewUrl } from "@/lib/storage";
import { WardrobeItem } from "@/models/WardrobeItem";
import { WardrobeUpload } from "@/models/WardrobeUpload";

type RouteContext = {
  params: {
    key: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const storageKey = decodeURIComponent(context.params.key);
    const ownedObject =
      (await WardrobeUpload.findOne({ userId: auth.user._id, storageKey }).select("_id").lean()) ||
      (await WardrobeItem.findOne({ userId: auth.user._id, storageKey }).select("_id").lean());

    if (!ownedObject) return apiError("NOT_FOUND", "Image access was not found.");

    const view = await createSignedViewUrl({ storageKey });

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "storage.signed_view",
      entityType: "StorageObject",
      entityId: storageKey
    });

    return apiSuccess({ view });
  } catch (error) {
    console.error("FitPick signed view error:", error);
    return apiError("INTERNAL_ERROR", "Unable to create image access right now.");
  }
}
