import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyOnChainPayment: vi.fn(),
  getJobByPaymentAddress: vi.fn(),
  applyConfirmedPayment: vi.fn(),
  dispatchSingleJob: vi.fn(),
  triggerInstantSweepForJob: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(),
  isAuthorizedWebhookRequest: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    HELIUS_WEBHOOK_SECRET: "webhook-secret",
  }),
}));

vi.mock("@/lib/payments/onchain-verify", () => ({
  verifyOnChainPayment: mocks.verifyOnChainPayment,
}));

vi.mock("@/lib/jobs/repository", () => ({
  getJobByPaymentAddress: mocks.getJobByPaymentAddress,
  applyConfirmedPayment: mocks.applyConfirmedPayment,
}));

vi.mock("@/lib/jobs/dispatch", () => ({
  dispatchSingleJob: mocks.dispatchSingleJob,
}));

vi.mock("@/lib/payments/trigger-sweep", () => ({
  triggerInstantSweepForJob: mocks.triggerInstantSweepForJob,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock("@/lib/security/request-ip", () => ({
  getRequestIp: mocks.getRequestIp,
}));

vi.mock("@/lib/security/webhook-auth", () => ({
  isAuthorizedWebhookRequest: mocks.isAuthorizedWebhookRequest,
}));

import { POST } from "@/app/api/helius-webhook/route";

function buildRequest(): NextRequest {
  return new NextRequest("http://localhost/api/helius-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer webhook-secret",
    },
    body: JSON.stringify([{ signature: "sig-1" }]),
  });
}

describe("helius webhook instant sweep trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestIp.mockReturnValue("127.0.0.1");
    mocks.isAuthorizedWebhookRequest.mockReturnValue(true);
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true });
    mocks.verifyOnChainPayment.mockResolvedValue({
      confirmed: true,
      transfers: [{ destination: "pay-address-1", lamports: 1_000_000 }],
    });
    mocks.getJobByPaymentAddress.mockResolvedValue({
      jobId: "job-1",
      status: "awaiting_payment",
      requiredLamports: 2_000_000,
      receivedLamports: 0,
    });
    mocks.dispatchSingleJob.mockResolvedValue({ status: "dispatched" });
    mocks.triggerInstantSweepForJob.mockResolvedValue(undefined);
  });

  it("triggers instant sweep for partial payments", async () => {
    mocks.applyConfirmedPayment.mockResolvedValue({
      job: {
        jobId: "job-1",
        status: "payment_detected",
        requiredLamports: 2_000_000,
        receivedLamports: 1_000_000,
      },
      duplicate: false,
      newlyConfirmed: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.results[0].result).toBe("partial_payment");
    expect(mocks.triggerInstantSweepForJob).toHaveBeenCalledWith("job-1");
    expect(mocks.dispatchSingleJob).not.toHaveBeenCalled();
  });

  it("triggers instant sweep and dispatches when payment becomes confirmed", async () => {
    mocks.applyConfirmedPayment.mockResolvedValue({
      job: {
        jobId: "job-1",
        status: "payment_confirmed",
        requiredLamports: 2_000_000,
        receivedLamports: 2_000_000,
      },
      duplicate: false,
      newlyConfirmed: true,
    });
    mocks.dispatchSingleJob.mockResolvedValue({ status: "dispatched" });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0].result).toBe("confirmed");
    expect(body.results[0].dispatch).toBe("ok");
    expect(mocks.triggerInstantSweepForJob).toHaveBeenCalledWith("job-1");
    expect(mocks.dispatchSingleJob).toHaveBeenCalledWith("job-1");
  });

  it("does not fail webhook response when instant sweep trigger rejects", async () => {
    mocks.applyConfirmedPayment.mockResolvedValue({
      job: {
        jobId: "job-1",
        status: "payment_detected",
        requiredLamports: 2_000_000,
        receivedLamports: 1_000_000,
      },
      duplicate: false,
      newlyConfirmed: false,
    });
    mocks.triggerInstantSweepForJob.mockRejectedValue(new Error("worker down"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.triggerInstantSweepForJob).toHaveBeenCalledWith("job-1");
  });
});
