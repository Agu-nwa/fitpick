import type { NextRequest } from "next/server";
import { AuditEvent } from "@/models/AuditEvent";

export type AuditAction =
  | "auth.register"
  | "auth.login"
  | "auth.logout"
  | "user.update"
  | "preferences.update"
  | "admin.seed"
  | "wardrobe.upload"
  | "wardrobe.create"
  | "wardrobe.update"
  | "wardrobe.tags.review"
  | "wardrobe.upload.review"
  | "wardrobe.archive"
  | "wardrobe.delete"
  | "outfit.recommend"
  | "outfit.swap"
  | "outfit.save"
  | "outfit.wear"
  | "outfit.feedback"
  | "billing.change"
  | "billing.checkout"
  | "entitlement.change"
  | "notifications.update"
  | "privacy.update"
  | "account.delete_request"
  | "storage.signed_upload"
  | "storage.signed_view";

export function requestMeta(request: NextRequest) {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown",
    userAgent: request.headers.get("user-agent") || "unknown"
  };
}

export async function recordAuditEvent(input: {
  request: NextRequest;
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
}) {
  try {
    const meta = requestMeta(input.request);

    await AuditEvent.create({
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ip: meta.ip,
      userAgent: meta.userAgent
    });
  } catch (error) {
    console.warn("Audit event was not recorded.", error);
  }
}
