import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJobArtifacts: vi.fn(),
  getInternalVideoRender: vi.fn(),
  upsertReport: vi.fn(),
  upsertVideo: vi.fn(),
  updateJobStatus: vi.fn(),
  markJobFailed: vi.fn(),
  generateReportPdf: vi.fn(),
  uploadBufferToStorage: vi.fn(),
  uploadRemoteFileToStorage: vi.fn(),
  triggerJobProcessing: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    JOB_PROCESSING_STALE_MS: 120_000,
  }),
}));

vi.mock("@/lib/jobs/repository", () => ({
  getJobArtifacts: mocks.getJobArtifacts,
  getInternalVideoRender: mocks.getInternalVideoRender,
  upsertReport: mocks.upsertReport,
  upsertVideo: mocks.upsertVideo,
  updateJobStatus: mocks.updateJobStatus,
  markJobFailed: mocks.markJobFailed,
}));

vi.mock("@/lib/pdf/report", () => ({
  generateReportPdf: mocks.generateReportPdf,
}));

vi.mock("@/lib/storage/upload", () => ({
  uploadBufferToStorage: mocks.uploadBufferToStorage,
  uploadRemoteFileToStorage: mocks.uploadRemoteFileToStorage,
}));

vi.mock("@/lib/jobs/trigger", () => ({
  triggerJobProcessing: mocks.triggerJobProcessing,
}));

import { recoverJobIfNeeded } from "@/lib/jobs/recovery";

describe("recoverJobIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finalizes a job from a ready internal render", async () => {
    mocks.getJobArtifacts.mockResolvedValue({
      job: {
        jobId: "job-1",
        status: "processing",
        progress: "generating_video",
        videoSeconds: 30,
      },
      report: {
        jobId: "job-1",
        wallet: "wallet",
        rangeDays: 1,
        pumpTokensTraded: 1,
        buyCount: 1,
        sellCount: 1,
        solSpent: 1,
        solReceived: 1,
        estimatedPnlSol: 1,
        bestTrade: "best",
        worstTrade: "worst",
        styleClassification: "style",
        summary: "summary",
        timeline: [],
        downloadUrl: null,
      },
      video: {
        jobId: "job-1",
        videoUrl: null,
        thumbnailUrl: null,
        duration: 30,
        renderStatus: "queued",
      },
    });
    mocks.getInternalVideoRender.mockResolvedValue({
      jobId: "job-1",
      status: "ready",
      renderStatus: "ready",
      videoUrl: "https://internal/video.mp4",
      thumbnailUrl: "https://internal/thumb.jpg",
    });
    mocks.generateReportPdf.mockResolvedValue(Buffer.from("pdf"));
    mocks.uploadBufferToStorage.mockResolvedValue("https://public/report.pdf");
    mocks.uploadRemoteFileToStorage
      .mockResolvedValueOnce("https://public/video.mp4")
      .mockResolvedValueOnce("https://public/thumb.jpg");

    const recovered = await recoverJobIfNeeded("job-1");

    expect(recovered).toBe(true);
    expect(mocks.upsertReport).toHaveBeenCalledWith(
      expect.objectContaining({ downloadUrl: "https://public/report.pdf" }),
    );
    expect(mocks.upsertVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        videoUrl: "https://public/video.mp4",
        thumbnailUrl: "https://public/thumb.jpg",
        renderStatus: "ready",
      }),
    );
    expect(mocks.updateJobStatus).toHaveBeenCalledWith(
      "job-1",
      "complete",
      expect.objectContaining({ progress: "complete" }),
    );
  });

  it("re-triggers stale processing jobs without a ready internal render", async () => {
    mocks.getJobArtifacts.mockResolvedValue({
      job: {
        jobId: "job-2",
        status: "processing",
        progress: "generating_video",
        updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      },
      report: null,
      video: null,
    });
    mocks.getInternalVideoRender.mockResolvedValue(null);

    const recovered = await recoverJobIfNeeded("job-2");

    expect(recovered).toBe(false);
    expect(mocks.triggerJobProcessing).toHaveBeenCalledWith("job-2");
  });

  it("restores public processing state from an in-flight internal render", async () => {
    mocks.getJobArtifacts.mockResolvedValue({
      job: {
        jobId: "job-3",
        status: "failed",
        progress: "failed",
        videoSeconds: 30,
      },
      report: null,
      video: {
        jobId: "job-3",
        videoUrl: null,
        thumbnailUrl: null,
        duration: 30,
        renderStatus: "queued",
      },
    });
    mocks.getInternalVideoRender.mockResolvedValue({
      jobId: "job-3",
      status: "processing",
      renderStatus: "processing",
      videoUrl: null,
      thumbnailUrl: null,
      error: null,
    });

    const recovered = await recoverJobIfNeeded("job-3");

    expect(recovered).toBe(true);
    expect(mocks.upsertVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-3",
        renderStatus: "processing",
      }),
    );
    expect(mocks.updateJobStatus).toHaveBeenCalledWith(
      "job-3",
      "processing",
      expect.objectContaining({
        progress: "generating_video",
      }),
    );
  });
});
