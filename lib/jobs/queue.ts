import type { Types } from "mongoose";
import { BackgroundJob } from "@/models/BackgroundJob";
import { logJobEvent } from "@/lib/ai/observability/ai-logger";

export type BackgroundJobType =
  | "wardrobe_analysis"
  | "label_ocr"
  | "outfit_preview_generation"
  | "avatar_preview_generation"
  | "garment_background_processing"
  | "style_profile_learning"
  | "memory_rollup";

export type BackgroundJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

type EnqueueOptions = {
  userId: string | Types.ObjectId;
  maxAttempts?: number;
  availableAt?: Date;
};

function scrubPayload(payload: Record<string, unknown> = {}) {
  return JSON.parse(JSON.stringify(payload, (key, value) => {
    if (/secret|token|key|base64|b64|signed/i.test(key)) return undefined;
    if (typeof value === "string" && value.length > 600) return value.slice(0, 600);
    return value;
  }));
}

export async function enqueueJob(type: BackgroundJobType, payload: Record<string, unknown>, options: EnqueueOptions) {
  const job = await BackgroundJob.create({
    userId: options.userId,
    type,
    status: "queued",
    payload: scrubPayload(payload),
    maxAttempts: Math.max(1, Math.min(options.maxAttempts || 3, 10)),
    availableAt: options.availableAt || new Date()
  });

  logJobEvent({ event: "job_enqueued", jobId: String(job._id), type, status: "queued" });
  return job;
}

export async function getJob(jobId: string, userId?: string | Types.ObjectId) {
  return BackgroundJob.findOne({
    _id: jobId,
    ...(userId ? { userId } : {})
  }).lean();
}

export async function updateJobStatus(jobId: string, status: BackgroundJobStatus, patch: Record<string, unknown> = {}) {
  const set: Record<string, unknown> = {
    ...patch,
    status
  };

  if (status === "processing") set.startedAt = new Date();
  if (status === "completed") set.completedAt = new Date();
  if (status === "failed") set.failedAt = new Date();

  const job = await BackgroundJob.findByIdAndUpdate(jobId, { $set: set }, { new: true });
  if (job) logJobEvent({ event: `job_${status}`, jobId: String(job._id), type: job.type, status });
  return job;
}

export async function claimNextJob() {
  const now = new Date();
  const job = await BackgroundJob.findOneAndUpdate(
    {
      status: "queued",
      availableAt: { $lte: now },
      $expr: { $lt: ["$attempts", "$maxAttempts"] }
    },
    {
      $set: {
        status: "processing",
        startedAt: now,
        errorMessage: ""
      },
      $inc: { attempts: 1 }
    },
    {
      sort: { availableAt: 1, createdAt: 1 },
      new: true
    }
  );

  if (job) logJobEvent({ event: "job_claimed", jobId: String(job._id), type: job.type, status: "processing", attempts: job.attempts });
  return job;
}

export async function scheduleJobRetry(job: any, errorMessage: string) {
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.maxAttempts || 3);

  if (attempts >= maxAttempts) {
    logJobEvent({ event: "job_max_attempts", jobId: String(job._id), type: job.type, status: "failed", attempts });
    return updateJobStatus(String(job._id), "failed", {
      errorMessage,
      failedAt: new Date()
    });
  }

  const delayMs = Math.min(15 * 60_000, Math.pow(2, attempts) * 30_000);
  const availableAt = new Date(Date.now() + delayMs);
  const updated = await BackgroundJob.findByIdAndUpdate(
    job._id,
    {
      $set: {
        status: "queued",
        availableAt,
        errorMessage
      }
    },
    { new: true }
  );

  logJobEvent({ event: "job_retry_scheduled", jobId: String(job._id), type: job.type, status: "queued", attempts });
  return updated;
}

export function serializeJob(job: any) {
  return {
    id: String(job._id),
    type: job.type,
    status: job.status,
    attempts: job.attempts || 0,
    maxAttempts: job.maxAttempts || 0,
    result: job.result || {},
    errorMessage: job.errorMessage || "",
    availableAt: job.availableAt ? new Date(job.availableAt).toISOString() : null,
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
    failedAt: job.failedAt ? new Date(job.failedAt).toISOString() : null,
    createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    updatedAt: job.updatedAt ? new Date(job.updatedAt).toISOString() : null
  };
}

export function backgroundJobsEnabled() {
  return process.env.ENABLE_BACKGROUND_JOBS === "true";
}
