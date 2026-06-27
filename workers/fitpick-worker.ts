import { connectDB } from "@/lib/db";
import { errorCategory, logJobEvent } from "@/lib/ai/observability/ai-logger";
import { claimNextJob, scheduleJobRetry, updateJobStatus } from "@/lib/jobs/queue";
import { runBackgroundJobByType } from "@/lib/jobs/handlers";

const pollMs = Number(process.env.WORKER_POLL_MS || 5000);
let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
});

process.on("SIGTERM", () => {
  stopping = true;
});

async function processOneJob() {
  const job = await claimNextJob();
  if (!job) return false;

  try {
    const result = await runBackgroundJobByType(job);
    await updateJobStatus(String(job._id), "completed", {
      result,
      errorMessage: ""
    });
    logJobEvent({ event: "job_completed", jobId: String(job._id), type: job.type, status: "completed", attempts: job.attempts });
  } catch (error) {
    const message = "Background job failed safely.";
    logJobEvent({
      event: "job_failed",
      jobId: String(job._id),
      type: job.type,
      status: "failed",
      attempts: job.attempts,
      errorCategory: errorCategory(error)
    });
    await scheduleJobRetry(job, message);
  }

  return true;
}

async function main() {
  await connectDB();
  console.info("fitpick.worker", { status: "started", pollMs, timestamp: new Date().toISOString() });

  while (!stopping) {
    const worked = await processOneJob();
    if (!worked) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  console.info("fitpick.worker", { status: "stopped", timestamp: new Date().toISOString() });
}

main().catch((error) => {
  console.error("fitpick.worker", {
    status: "fatal",
    errorCategory: errorCategory(error),
    timestamp: new Date().toISOString()
  });
  process.exit(1);
});
