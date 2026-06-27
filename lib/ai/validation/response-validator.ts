import { z } from "zod";

export function safeParseJson(text: string) {
  try {
    const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
    return { ok: true as const, data: JSON.parse(trimmed || "{}") };
  } catch {
    return buildValidationFailure("Invalid JSON response.");
  }
}

export function validateJsonResponse<TSchema extends z.ZodTypeAny>(schema: TSchema, data: unknown) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) return buildValidationFailure("AI response did not match the expected schema.");
  return { ok: true as const, data: parsed.data as z.infer<TSchema> };
}

export function buildValidationFailure(reason: string) {
  return { ok: false as const, reason };
}
