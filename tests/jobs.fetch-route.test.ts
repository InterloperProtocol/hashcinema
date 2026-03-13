import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recoverJobIfNeeded: vi.fn(),
  getJobArtifacts: vi.fn(),
  buildPaymentInstructions: vi.fn(),
}));

vi.mock("@/lib/jobs/recovery", () => ({
  recoverJobIfNeeded: mocks.recoverJobIfNeeded,
}));

vi.mock("@/lib/jobs/repository", () => ({
  getJobArtifacts: mocks.getJobArtifacts,
}));

vi.mock("@/lib/payments/instructions", () => ({
  buildPaymentInstructions: mocks.buildPaymentInstructions,
}));

import { GET } from "@/app/api/jobs/[jobId]/route";

describe("GET /api/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildPaymentInstructions.mockReturnValue({
      paymentAddress: "11111111111111111111111111111111",
      amountSol: 0.02,
      receivedSol: 0.02,
      remainingSol: 0,
    });
    mocks.getJobArtifacts.mockResolvedValue({
      job: {
        jobId: "job-1",
        wallet: "wallet-1",
        packageType: "1d",
        rangeDays: 1,
        priceSol: 0.02,
        videoSeconds: 30,
        status: "processing",
        progress: "generating_video",
        txSignature: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
        paymentAddress: "11111111111111111111111111111111",
        paymentIndex: 1,
        paymentRouting: "dedicated_address",
        requiredLamports: 20_000_000,
        receivedLamports: 20_000_000,
        paymentSignatures: [],
        lastPaymentAt: null,
        sweepStatus: "pending",
        sweepSignature: null,
        sweptLamports: 0,
        lastSweepAt: null,
        sweepError: null,
      },
      report: null,
      video: null,
    });
  });

  it("returns job artifacts even when recovery throws", async () => {
    mocks.recoverJobIfNeeded.mockRejectedValue(new Error("unicode pdf failed"));

    const response = await GET(new Request("http://localhost/api/jobs/job-1"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.job.jobId).toBe("job-1");
    expect(body.warning).toContain("unicode pdf failed");
  });
});
