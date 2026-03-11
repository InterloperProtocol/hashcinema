import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  ensurePaymentAddressSubscribedToHeliusWebhook: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(),
}));

vi.mock("@/lib/jobs/repository", () => ({
  createJob: mocks.createJob,
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
    expect(mocks.createJob).toHaveBeenCalledTimes(1);
    expect(mocks.ensurePaymentAddressSubscribedToHeliusWebhook).toHaveBeenCalledWith(
      "11111111111111111111111111111111",
    );
  });

  it("returns 500 when webhook subscription fails", async () => {
    mocks.ensurePaymentAddressSubscribedToHeliusWebhook.mockRejectedValue(
      new Error("helius webhook update failed"),
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to create job");
    expect(String(body.message)).toContain("helius webhook update failed");
  });
});
