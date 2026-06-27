type AiLogEvent = {
  operation: string;
  model: string;
  latencyMs: number;
  status: "success" | "failed";
  cacheHit?: boolean;
  provider?: string;
  bytes?: number;
  errorCategory?: string;
};

export function logAiEvent(event: AiLogEvent) {
  console.info("fitpick.ai", {
    operation: event.operation,
    model: event.model,
    latencyMs: event.latencyMs,
    status: event.status,
    cacheHit: Boolean(event.cacheHit),
    provider: event.provider || "",
    bytes: event.bytes || 0,
    errorCategory: event.errorCategory || "",
    timestamp: new Date().toISOString()
  });
}

export function errorCategory(error: unknown) {
  if (error instanceof SyntaxError) return "json_parse";
  if (error instanceof Error && /rate/i.test(error.message)) return "rate_limit";
  if (error instanceof Error && /S3|storage|upload/i.test(error.message)) return "storage";
  if (error instanceof Error && /environment|configured|ENV_/i.test(error.message)) return "configuration";
  if (error instanceof Error && error.name) return error.name;
  return "unknown";
}

export function logJobEvent(event: {
  event: string;
  jobId: string;
  type: string;
  status: string;
  attempts?: number;
  errorCategory?: string;
}) {
  console.info("fitpick.job", {
    event: event.event,
    jobId: event.jobId,
    type: event.type,
    status: event.status,
    attempts: event.attempts || 0,
    errorCategory: event.errorCategory || "",
    timestamp: new Date().toISOString()
  });
}
