import { POST } from "@/app/api/jobs/[jobId]/retry/route";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  triggerFailedJobRetry: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(),
}));

vi.mock("@/lib/jobs/trigger-retry", () => ({
  triggerFailedJobRetry: mocks.triggerFailedJobRetry,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock("@/lib/security/request-ip", () => ({
  getRequestIp: mocks.getRequestIp,
}));

function buildRequest(): NextRequest {
  return new NextRequest("http://localhost/api/jobs/b25f5355-5392-4dd0-b9c0-f644222ceba2/retry", {
    method: "POST",
  });
}

describe("POST /api/jobs/[jobId]/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestIp.mockReturnValue("127.0.0.1");
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns ok when retry is dispatched", async () => {
    mocks.triggerFailedJobRetry.mockResolvedValue({
      jobId: "b25f5355-5392-4dd0-b9c0-f644222ceba2",
      status: "dispatched",
    });

    const response = await POST(buildRequest(), {
      params: Promise.resolve({ jobId: "b25f5355-5392-4dd0-b9c0-f644222ceba2" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.triggerFailedJobRetry).toHaveBeenCalledWith(
      "b25f5355-5392-4dd0-b9c0-f644222ceba2",
    );
  });

  it("returns 409 when retry is safely skipped", async () => {
    mocks.triggerFailedJobRetry.mockResolvedValue({
      jobId: "b25f5355-5392-4dd0-b9c0-f644222ceba2",
      status: "skipped",
      reason: "payment_incomplete",
    });

    const response = await POST(buildRequest(), {
      params: Promise.resolve({ jobId: "b25f5355-5392-4dd0-b9c0-f644222ceba2" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("payment_incomplete");
  });
});
