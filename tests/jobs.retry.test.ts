import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepareFailedJobForRetry: vi.fn(),
  dispatchSingleJob: vi.fn(),
}));

vi.mock("@/lib/jobs/repository", () => ({
  prepareFailedJobForRetry: mocks.prepareFailedJobForRetry,
}));

vi.mock("@/lib/jobs/dispatch", () => ({
  dispatchSingleJob: mocks.dispatchSingleJob,
}));

import { retryFailedJob } from "@/lib/jobs/retry";

describe("retryFailedJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches when failed paid job is prepared", async () => {
    mocks.prepareFailedJobForRetry.mockResolvedValue({
      status: "ready",
      job: { jobId: "job-1" },
    });
    mocks.dispatchSingleJob.mockResolvedValue({
      jobId: "job-1",
      status: "dispatched",
    });

    const result = await retryFailedJob("job-1");

    expect(mocks.dispatchSingleJob).toHaveBeenCalledWith("job-1");
    expect(result).toEqual({
      jobId: "job-1",
      status: "dispatched",
      error: undefined,
    });
  });

  it("skips retry when job is not eligible", async () => {
    mocks.prepareFailedJobForRetry.mockResolvedValue({
      status: "payment_incomplete",
      job: { jobId: "job-1" },
    });

    const result = await retryFailedJob("job-1");

    expect(mocks.dispatchSingleJob).not.toHaveBeenCalled();
    expect(result).toEqual({
      jobId: "job-1",
      status: "skipped",
      reason: "payment_incomplete",
    });
  });
});

