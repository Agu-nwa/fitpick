export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { getJob, serializeJob } from "@/lib/jobs/queue";
import { isObjectId } from "@/lib/wardrobe";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (!isObjectId(context.params.id)) return apiError("NOT_FOUND", "Job was not found.");

    const job = await getJob(context.params.id, auth.user._id);
    if (!job) return apiError("NOT_FOUND", "Job was not found.");

    return apiSuccess({ job: serializeJob(job) });
  } catch {
    return apiError("INTERNAL_ERROR", "Unable to load job status right now.");
  }
}
