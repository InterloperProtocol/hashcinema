import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { fetchWithTimeout } from "@/lib/network/http";
import {
  isRetryableHttpStatus,
  RetryableError,
  withRetry,
} from "@/lib/network/retry";

function buildSweepEndpoint(workerUrl: string): string {
  return new URL("/sweep", workerUrl).toString();
}

export async function triggerInstantSweepForJob(jobId: string): Promise<void> {
  const env = getEnv();
  if (!env.WORKER_URL) {
    logger.warn("instant_sweep_skipped_worker_url_missing", {
      component: "payments_trigger_sweep",
      stage: "trigger_sweep",
      jobId,
      errorCode: "worker_url_missing",
    });
    return;
  }

  if (!env.WORKER_TOKEN) {
    logger.warn("instant_sweep_skipped_worker_token_missing", {
      component: "payments_trigger_sweep",
      stage: "trigger_sweep",
      jobId,
      errorCode: "worker_token_missing",
    });
    return;
  }

  const endpoint = buildSweepEndpoint(env.WORKER_URL);

  try {
    await withRetry(
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
          const message = `Failed to trigger instant sweep (${response.status}): ${body || "empty response"}`;
          if (isRetryableHttpStatus(response.status)) {
            throw new RetryableError(message);
          }
          throw new Error(message);
        }
      },
      {
        attempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 3_000,
        onRetry: ({ attempt, delayMs, error }) => {
          logger.warn("instant_sweep_retry", {
            component: "payments_trigger_sweep",
            stage: "trigger_sweep",
            jobId,
            attempt,
            durationMs: delayMs,
            errorCode: "instant_sweep_retry",
            errorMessage: error instanceof Error ? error.message : "unknown",
          });
        },
      },
    );
  } catch (error) {
    logger.warn("instant_sweep_trigger_failed", {
      component: "payments_trigger_sweep",
      stage: "trigger_sweep",
      jobId,
      errorCode: "instant_sweep_trigger_failed",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
  }
}
