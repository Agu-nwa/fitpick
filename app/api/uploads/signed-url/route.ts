export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { createSignedUploadUrl } from "@/lib/storage";
import { readJson, validateBody } from "@/lib/validation";
import { signedUploadSchema } from "@/schemas/upload.schema";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(signedUploadSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const upload = await createSignedUploadUrl({
      userId: String(auth.user._id),
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      purpose: parsed.data.purpose
    });

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "storage.signed_upload",
      entityType: "StorageObject",
      entityId: upload.storageKey
    });

    return apiSuccess({ upload }, { message: "Signed upload scaffold created." });
  } catch (error) {
    console.error("FitPick signed upload error:", error);
    return apiError("INTERNAL_ERROR", "Unable to create upload access right now.");
  }
}
