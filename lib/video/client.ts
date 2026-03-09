import { getEnv } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/network/http";
import {
  isRetryableHttpStatus,
  RetryableError,
  withRetry,
} from "@/lib/network/retry";
import { GeneratedCinematicScript } from "@/lib/types/domain";

interface StartRenderResponse {
  id?: string;
  jobId?: string;
  statusUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
}

interface PollRenderResponse {
  status?: string;
  renderStatus?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function renderCinematicVideo(params: {
  jobId: string;
  wallet: string;
  durationSeconds: number;
  script: GeneratedCinematicScript;
}): Promise<{ videoUrl: string; thumbnailUrl: string | null }> {
  const env = getEnv();
  if (!env.VIDEO_API_BASE_URL) {
    throw new Error(
      "VIDEO_API_BASE_URL is required to render cinematic videos.",
    );
  }

  const startPayload = await withRetry(
    async () => {
      const startResponse = await fetchWithTimeout(
        `${env.VIDEO_API_BASE_URL}/render`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.VIDEO_API_KEY}`,
          },
          body: JSON.stringify({
            jobId: params.jobId,
            wallet: params.wallet,
            durationSeconds: params.durationSeconds,
            withSound: true,
            hookLine: params.script.hookLine,
            scenes: params.script.scenes.map((scene) => ({
              ...scene,
              includeAudio: true,
            })),
          }),
        },
        20_000,
      );

      if (!startResponse.ok) {
        const body = await startResponse.text();
        const message = `Video render request failed (${startResponse.status}): ${body}`;
        if (isRetryableHttpStatus(startResponse.status)) {
          throw new RetryableError(message);
        }
        throw new Error(message);
      }

      return (await startResponse.json()) as StartRenderResponse;
    },
    {
      attempts: 3,
      baseDelayMs: 900,
      maxDelayMs: 5_000,
    },
  );

  if (startPayload.videoUrl) {
    return {
      videoUrl: startPayload.videoUrl,
      thumbnailUrl: startPayload.thumbnailUrl ?? null,
    };
  }

  const renderId = startPayload.id ?? startPayload.jobId;
  if (!renderId && !startPayload.statusUrl) {
    throw new Error("Video API did not return a render identifier.");
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(5000);
    const pollUrl =
      startPayload.statusUrl ?? `${env.VIDEO_API_BASE_URL}/render/${renderId}`;
    let pollResponse: Response | null = null;
    try {
      pollResponse = await withRetry(
        async () => {
          const response = await fetchWithTimeout(
            pollUrl,
            {
              headers: {
                Authorization: `Bearer ${env.VIDEO_API_KEY}`,
              },
            },
            12_000,
          );

          if (!response.ok && isRetryableHttpStatus(response.status)) {
            throw new RetryableError(`Video render polling failed (${response.status})`);
          }

          return response;
        },
        {
          attempts: 2,
          baseDelayMs: 500,
          maxDelayMs: 2_000,
        },
      );
    } catch {
      continue;
    }

    if (!pollResponse.ok) continue;

    const pollPayload = (await pollResponse.json()) as PollRenderResponse;
    const status = (pollPayload.renderStatus ?? pollPayload.status ?? "").toLowerCase();

    if (status === "failed" || status === "error") {
      throw new Error(pollPayload.error ?? "Video render failed.");
    }

    if (
      status === "completed" ||
      status === "complete" ||
      status === "ready" ||
      pollPayload.videoUrl
    ) {
      if (!pollPayload.videoUrl) {
        throw new Error("Video render marked complete but videoUrl is missing.");
      }

      return {
        videoUrl: pollPayload.videoUrl,
        thumbnailUrl: pollPayload.thumbnailUrl ?? null,
      };
    }
  }

  throw new Error("Video rendering timed out.");
}
