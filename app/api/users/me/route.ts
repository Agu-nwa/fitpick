export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { readJson, validateBody } from "@/lib/validation";
import { updateUserSchema } from "@/schemas/user.schema";
import { toSafeUser } from "@/models/User";

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(updateUserSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    if (parsed.data.name !== undefined) auth.user.name = parsed.data.name;
    if (parsed.data.avatarUrl !== undefined) auth.user.avatarUrl = parsed.data.avatarUrl;
    if (parsed.data.timezone !== undefined) auth.user.timezone = parsed.data.timezone;
    if (parsed.data.locale !== undefined) auth.user.locale = parsed.data.locale;

    await auth.user.save();
    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "user.update",
      entityType: "User",
      entityId: String(auth.user._id)
    });

    return apiSuccess({ user: toSafeUser(auth.user) }, { message: "Profile updated." });
  } catch (error) {
    console.error("FitPick profile update error:", error);
    return apiError("INTERNAL_ERROR", "Unable to update your profile right now.");
  }
}
