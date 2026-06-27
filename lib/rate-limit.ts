import { apiError } from "@/lib/api-response";
import { logAiEvent } from "@/lib/ai/observability/ai-logger";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(input: {
  key: string;
  limit?: number;
  windowMs?: number;
  operation?: string;
}) {
  const limit = input.limit ?? 20;
  const windowMs = input.windowMs ?? 60_000;
  const now = Date.now();
  const current = buckets.get(input.key);

  if (!current || current.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  current.count += 1;

  if (current.count > limit) {
    logAiEvent({
      operation: input.operation || "rate-limit",
      model: "system",
      latencyMs: 0,
      status: "failed",
      errorCategory: "rate_limit_exceeded"
    });
    return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.");
  }

  return null;
}

export const rateLimitPlaceholder = rateLimit;
