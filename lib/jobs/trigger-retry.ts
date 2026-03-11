import { getEnv } from "@/lib/env";
import { retryFailedJob, RetryFailedJobResult } from "@/lib/jobs/retry";
import { logger } from "@/lib/logging/logger";
import { fetchWithTimeout } from "@/lib/network/http";
import {
  isRetryableHttpStatus,
  RetryableError,
  withRetry,
} from "@/lib/network/retry";

function buildRetryEndpoint(workerUrl: string): string {
  return new URL("/retry-job", workerUrl).toString();
}

export async function triggerFailedJobRetry(
  jobId: string,
): Promise<RetryFailedJobResult> {
  const env = getEnv();
  if (!env.WORKER_URL) {
    return retryFailedJob(jobId);
  }

  if (!env.WORKER_TOKEN) {
    throw new Error("WORKER_TOKEN is required when WORKER_URL is configured");
  }

  const endpoint = buildRetryEndpoint(env.WORKER_URL);

  return withRetry(
    async () => {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.WORKER_TOKEN}`,
          },
          body: JSON.stringify({ jobId }),
        },
        12_000,
      );

      if (!response.ok) {
        const body = await response.text();
        const message = `Failed to trigger failed-job retry (${response.status}): ${body || "empty response"}`;
        if (isRetryableHttpStatus(response.status)) {
          throw new RetryableError(message);
        }
        throw new Error(message);
      }

      const body = (await response.json()) as {
        jobId?: string;
        status?: RetryFailedJobResult["status"];
        reason?: RetryFailedJobResult["reason"];
        error?: string;
      };

      if (!body.jobId || !body.status) {
        throw new Error("Worker retry endpoint returned an invalid payload");
      }

      return {
        jobId: body.jobId,
        status: body.status,
        reason: body.reason,
        error: body.error,
      };
    },
    {
      attempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 3_000,
      onRetry: ({ attempt, error, delayMs }) => {
        logger.warn("failed_job_retry_trigger_retry", {
          component: "jobs_retry",
          stage: "trigger_retry",
          jobId,
          attempt,
          durationMs: delayMs,
          errorCode: "failed_job_retry_trigger_retry",
          errorMessage: error instanceof Error ? error.message : "unknown",
        });
      },
    },
  );
}

