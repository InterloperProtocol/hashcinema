import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  findRecentReusableJob: vi.fn(),
  rollbackUnpaidJob: vi.fn(),
  ensurePaymentAddressSubscribedToHeliusWebhook: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(),
}));

vi.mock("@/lib/jobs/repository", () => ({
  createJob: mocks.createJob,
  findRecentReusableJob: mocks.findRecentReusableJob,
  rollbackUnpaidJob: mocks.rollbackUnpaidJob,
}));

vi.mock("@/lib/helius/webhook-subscriptions", () => ({
  ensurePaymentAddressSubscribedToHeliusWebhook:
    mocks.ensurePaymentAddressSubscribedToHeliusWebhook,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock("@/lib/security/request-ip", () => ({
  getRequestIp: mocks.getRequestIp,
}));

import { POST } from "@/app/api/jobs/route";

function buildRequest(): NextRequest {
  return new NextRequest("http://localhost/api/jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      wallet: "D1CRgh1Ty3yjDwN9CkwtsRWKmsmKQ2BbRbtKvCTfAN8Z",
      packageType: "1d",
    }),
  });
}

describe("POST /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestIp.mockReturnValue("127.0.0.1");
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true });
    mocks.findRecentReusableJob.mockResolvedValue(null);
    mocks.rollbackUnpaidJob.mockResolvedValue({
      rolledBack: true,
      job: null,
    });
    mocks.createJob.mockResolvedValue({
      jobId: "job-1",
      priceSol: 0.02,
      paymentAddress: "11111111111111111111111111111111",
      requiredLamports: 20_000_000,
    });
    mocks.ensurePaymentAddressSubscribedToHeliusWebhook.mockResolvedValue({
      webhookId: "wh-1",
      created: false,
      alreadySubscribed: false,
    });
  });

  it("creates a job and subscribes the payment address to Helius", async () => {
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.jobId).toBe("job-1");
    expect(body.reused).toBe(false);
    expect(mocks.createJob).toHaveBeenCalledTimes(1);
    expect(mocks.ensurePaymentAddressSubscribedToHeliusWebhook).toHaveBeenCalledWith(
      "11111111111111111111111111111111",
    );
  });

  it("reuses an existing recent job for same wallet/package", async () => {
    mocks.findRecentReusableJob.mockResolvedValue({
      jobId: "job-reused",
      priceSol: 0.02,
      paymentAddress: "11111111111111111111111111111111",
      requiredLamports: 20_000_000,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.jobId).toBe("job-reused");
    expect(body.reused).toBe(true);
    expect(mocks.createJob).not.toHaveBeenCalled();
    expect(mocks.ensurePaymentAddressSubscribedToHeliusWebhook).toHaveBeenCalledWith(
      "11111111111111111111111111111111",
    );
  });

  it("rolls back the new job and returns 503 when webhook subscription fails", async () => {
    mocks.ensurePaymentAddressSubscribedToHeliusWebhook.mockRejectedValue(
      new Error("helius webhook update failed"),
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Failed to subscribe payment address");
    expect(String(body.message)).toContain("helius webhook update failed");
    expect(body.rolledBack).toBe(true);
    expect(mocks.rollbackUnpaidJob).toHaveBeenCalledWith("job-1");
  });
});
