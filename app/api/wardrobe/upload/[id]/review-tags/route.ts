export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent, requestMeta } from "@/lib/audit";
import { rateLimitPlaceholder } from "@/lib/rate-limit";
import { readJson, validateBody } from "@/lib/validation";
import { inferCondition, isObjectId, serializeWardrobeItem, serializeWardrobeUpload } from "@/lib/wardrobe";
import { WardrobeItem } from "@/models/WardrobeItem";
import { WardrobeUpload } from "@/models/WardrobeUpload";
import { uploadTagReviewSchema } from "@/schemas/wardrobe.schema";

type RouteContext = {
  params: {
    id: string;
  };
};

function normalizeList(values?: string[]) {
  return (values || []).map((value) => value.trim()).filter(Boolean).slice(0, 20);
}

function buildConfirmedAnalysis(aiAnalysis: any, verifiedFields: Record<string, any> = {}) {
  if (!aiAnalysis?.fields) return null;

  const confirmedFields = Object.fromEntries(
    Object.entries(aiAnalysis.fields).map(([key, field]: [string, any]) => {
      const verified = verifiedFields[key];
      if (!verified) return [key, field];

      return [
        key,
        {
          ...field,
          value: verified.value,
          originalConfidence: field?.confidence ?? verified.originalConfidence ?? 0,
          confidence: 1,
          source: "user_confirmed"
        }
      ];
    })
  );

  return {
    ...aiAnalysis,
    status: "confirmed",
    fields: confirmedFields
  };
}

function verifiedMetadata(verifiedFields: Record<string, any> = {}) {
  return Object.fromEntries(
    Object.entries(verifiedFields).map(([key, field]: [string, any]) => [
      key,
      {
        value: field.value,
        confidence: 1,
        originalConfidence: field.originalConfidence ?? field.confidence ?? 0,
        source: "user_confirmed"
      }
    ])
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const meta = requestMeta(request);
  const limited = rateLimitPlaceholder({ key: `wardrobe-upload-review:${meta.ip}`, limit: 30, windowMs: 60 * 1000 });
  if (limited) return limited;

  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Wardrobe upload was not found.");

    const parsed = validateBody(uploadTagReviewSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;

    const upload = await WardrobeUpload.findOne({ _id: context.params.id, userId: auth.user._id });
    if (!upload) return apiError("NOT_FOUND", "Wardrobe upload was not found.");
    if (upload.createdItemId) {
      return apiError("CONFLICT", "This upload has already been added to your wardrobe.");
    }

    const verifiedFields = parsed.data.verifiedFields || {};
    const condition = inferCondition(parsed.data);
    const item = await WardrobeItem.create({
      name: parsed.data.name,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory || "",
      color: parsed.data.color,
      pattern: parsed.data.pattern || "",
      fabric: parsed.data.fabric || "",
      fit: parsed.data.fit || "",
      formality: normalizeList(parsed.data.formality),
      occasions: normalizeList(parsed.data.occasions),
      weather: normalizeList(parsed.data.weather),
      condition,
      userId: auth.user._id,
      storageKey: upload.storageKey,
      imageUrl: upload.imageUrl || "",
      thumbnailUrl: upload.thumbnailUrl || "",
      images: upload.images || {},
      verifiedMetadata: verifiedMetadata(verifiedFields),
      aiAnalysis: buildConfirmedAnalysis(upload.aiAnalysis, verifiedFields)
    });

    upload.createdItemId = item._id;
    upload.reviewedAt = new Date();
    upload.aiTagStatus = "completed";
    await upload.save();

    await recordAuditEvent({
      request,
      userId: String(auth.user._id),
      action: "wardrobe.upload.review",
      entityType: "WardrobeUpload",
      entityId: String(upload._id)
    });

    return apiSuccess(
      {
        item: serializeWardrobeItem(item),
        upload: serializeWardrobeUpload(upload),
        nextAction: "wardrobe-item-created"
      },
      { message: "Upload reviewed and wardrobe item created.", status: 201 }
    );
  } catch (error) {
    console.error("FitPick upload tag review error:", error);
    return apiError("INTERNAL_ERROR", "Unable to review upload tags right now.");
  }
}
