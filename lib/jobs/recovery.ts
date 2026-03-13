import { getEnv } from "@/lib/env";
import { generateReportPdf } from "@/lib/pdf/report";
import { uploadBufferToStorage, uploadRemoteFileToStorage } from "@/lib/storage/upload";
import { InternalVideoRenderDocument } from "@/lib/types/domain";
import {
  getInternalVideoRender,
  getJobArtifacts,
  markJobFailed,
  updateJobStatus,
  upsertReport,
  upsertVideo,
} from "./repository";
import { triggerJobProcessing } from "./trigger";

function isStale(updatedAt: string, staleAfterMs: number): boolean {
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs)) {
    return true;
  }
  return Date.now() - updatedAtMs >= staleAfterMs;
}

async function finalizeReadyRender(
  jobId: string,
  render: InternalVideoRenderDocument,
): Promise<boolean> {
  const { job, report, video } = await getJobArtifacts(jobId);
  if (!job || !report || !render.videoUrl) {
    return false;
  }

  const [reportUrl, publicVideoUrl, publicThumbnailUrl] = await Promise.all([
    report.downloadUrl
      ? Promise.resolve(report.downloadUrl)
      : generateReportPdf(report).then((pdfBuffer) =>
          uploadBufferToStorage({
            storagePath: `reports/${jobId}.pdf`,
            contentType: "application/pdf",
            data: pdfBuffer,
          }),
        ),
    video?.videoUrl
      ? Promise.resolve(video.videoUrl)
      : uploadRemoteFileToStorage({
          sourceUrl: render.videoUrl,
          storagePath: `videos/${jobId}.mp4`,
          contentType: "video/mp4",
        }),
    video?.thumbnailUrl
      ? Promise.resolve(video.thumbnailUrl)
      : render.thumbnailUrl
        ? uploadRemoteFileToStorage({
            sourceUrl: render.thumbnailUrl,
            storagePath: `videos/${jobId}-thumbnail.jpg`,
            contentType: "image/jpeg",
          })
        : Promise.resolve(null),
  ]);

  await Promise.all([
    upsertReport({
      ...report,
      downloadUrl: reportUrl,
    }),
    upsertVideo({
      jobId,
      videoUrl: publicVideoUrl,
      thumbnailUrl: publicThumbnailUrl,
      duration: job.videoSeconds,
      renderStatus: "ready",
    }),
    updateJobStatus(jobId, "complete", {
      progress: "complete",
      errorCode: null,
      errorMessage: null,
    }),
  ]);

  return true;
}

async function syncFailedRender(
  jobId: string,
  render: InternalVideoRenderDocument,
): Promise<boolean> {
  const { job } = await getJobArtifacts(jobId);
  if (!job || job.status !== "processing") {
    return false;
  }

  await markJobFailed(
    jobId,
    "video_render_failed",
    render.error ?? "Video render failed before asset finalization.",
  );
  return true;
}

async function syncInFlightRender(
  jobId: string,
  render: InternalVideoRenderDocument,
): Promise<boolean> {
  const { job } = await getJobArtifacts(jobId);
  if (!job) {
    return false;
  }

  await Promise.all([
    upsertVideo({
      jobId,
      videoUrl: null,
      thumbnailUrl: null,
      duration: job.videoSeconds,
      renderStatus: "processing",
    }),
    updateJobStatus(jobId, "processing", {
      progress: "generating_video",
      errorCode: null,
      errorMessage: null,
    }),
  ]);

  return true;
}

export async function recoverJobIfNeeded(jobId: string): Promise<boolean> {
  const env = getEnv();
  const { job, video } = await getJobArtifacts(jobId);
  if (!job || job.status === "complete") {
    return false;
  }

  const render = await getInternalVideoRender(jobId);

  if (render?.status === "ready" && !video?.videoUrl) {
    return finalizeReadyRender(jobId, render);
  }

  if (
    render &&
    (render.status === "processing" || render.status === "queued") &&
    (job.status === "failed" || job.status === "payment_confirmed")
  ) {
    return syncInFlightRender(jobId, render);
  }

  if (render?.status === "failed" && job.status === "processing") {
    return syncFailedRender(jobId, render);
  }

  if (job.status === "processing" && isStale(job.updatedAt, env.JOB_PROCESSING_STALE_MS)) {
    await triggerJobProcessing(jobId);
    return false;
  }

  return false;
}
