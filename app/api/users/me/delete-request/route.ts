export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { readJson, validateBody } from "@/lib/validation";
import { PrivacyPreference } from "@/models/PrivacyPreference";
import { deleteRequestSchema } from "@/schemas/user.schema";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(deleteRequestSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const privacy = await PrivacyPreference.findOneAndUpdate(
      { userId: auth.user._id },
      {
        $set: { accountDeletionRequestedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "account.delete_request",
      entityType: "PrivacyPreference",
      entityId: String(privacy._id)
    });

    return apiSuccess({
      deletionRequested: true,
      requestedAt: privacy.accountDeletionRequestedAt?.toISOString(),
      nextAction: "backend_deletion_workflow_pending"
    });
  } catch (error) {
    console.error("FitPick delete request error:", error);
    return apiError("INTERNAL_ERROR", "Unable to request account deletion right now.");
  }
}
