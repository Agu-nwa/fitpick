export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { checkoutPlaceholder, stripeConfigured } from "@/lib/billing";
import { readJson, validateBody } from "@/lib/validation";
import { BillingEvent } from "@/models/BillingEvent";
import { checkoutSchema } from "@/schemas/billing.schema";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = validateBody(checkoutSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const configured = stripeConfigured();
    const checkout = checkoutPlaceholder(parsed.data.plan);

    const event = await BillingEvent.create({
      userId: auth.user._id,
      provider: "stripe_placeholder",
      eventType: "checkout.requested",
      status: configured ? "provider_ready_placeholder" : "not_configured",
      metadata: { plan: parsed.data.plan }
    });

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "billing.checkout",
      entityType: "BillingEvent",
      entityId: String(event._id)
    });

    return apiSuccess({ checkout: { ...checkout, ready: false } }, { message: "Billing checkout placeholder created." });
  } catch (error) {
    console.error("FitPick checkout error:", error);
    return apiError("INTERNAL_ERROR", "Unable to start checkout right now.");
  }
}
