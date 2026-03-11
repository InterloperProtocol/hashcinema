import { dispatchSingleJob } from "@/lib/jobs/dispatch";
import { prepareFailedJobForRetry } from "@/lib/jobs/repository";
import { logger } from "@/lib/logging/logger";

export type RetryFailedJobReason =
  | "job_not_found"
  | "job_not_failed"
  | "payment_incomplete";

export interface RetryFailedJobResult {
  jobId: string;
  status: "dispatched" | "retry_scheduled" | "skipped";
  reason?: RetryFailedJobReason;
  error?: string;
}

export async function retryFailedJob(
  jobId: string,
): Promise<RetryFailedJobResult> {
  const prepared = await prepareFailedJobForRetry(jobId);
  if (prepared.status !== "ready") {
    return {
      jobId,
      status: "skipped",
      reason: prepared.status,
    };
  }

  const dispatch = await dispatchSingleJob(jobId);
  if (dispatch.status === "retry_scheduled") {
    logger.warn("failed_job_retry_dispatch_retry_scheduled", {
      component: "jobs_retry",
      stage: "dispatch",
      jobId,
      errorCode: "failed_job_retry_dispatch_retry_scheduled",
      errorMessage: dispatch.error ?? "dispatch retry scheduled",
    });
  }

  return {
    jobId,
    status: dispatch.status,
    error: dispatch.error,
  };
}

