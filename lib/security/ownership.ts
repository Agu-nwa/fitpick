import { apiError } from "@/lib/api-response";
import { isObjectId } from "@/lib/wardrobe";

export async function findOwnedDocument<T>({
  model,
  id,
  userId,
  notFoundMessage
}: {
  model: { findOne: (query: Record<string, unknown>) => Promise<T | null> };
  id: string;
  userId: unknown;
  notFoundMessage: string;
}) {
  if (!isObjectId(id)) {
    return { ok: false as const, response: apiError("NOT_FOUND", notFoundMessage) };
  }

  const document = await model.findOne({ _id: id, userId });
  if (!document) {
    return { ok: false as const, response: apiError("NOT_FOUND", notFoundMessage) };
  }

  return { ok: true as const, document };
}
