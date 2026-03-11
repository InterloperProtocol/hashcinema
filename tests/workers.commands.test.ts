import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildSweepSummary: vi.fn(),
  sweepDedicatedPaymentAddressForJob: vi.fn(),
  sweepDedicatedPaymentAddresses: vi.fn(),
}));

vi.mock("@/workers/sweep-payments", () => ({
  buildSweepSummary: mocks.buildSweepSummary,
  sweepDedicatedPaymentAddressForJob: mocks.sweepDedicatedPaymentAddressForJob,
  sweepDedicatedPaymentAddresses: mocks.sweepDedicatedPaymentAddresses,
}));

import { executeSweepCommand } from "@/workers/commands";

describe("worker sweep command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses single-job sweep mode when payload includes jobId", async () => {
    const singleResult = { jobId: "job-1", status: "swept" };
    const summary = {
      scanned: 1,
      swept: 1,
      pending: 0,
      failed: 0,
      results: [singleResult],
    };

    mocks.sweepDedicatedPaymentAddressForJob.mockResolvedValue(singleResult);
    mocks.buildSweepSummary.mockReturnValue(summary);

    const result = await executeSweepCommand({ jobId: "job-1", limit: 10 });

    expect(mocks.sweepDedicatedPaymentAddressForJob).toHaveBeenCalledWith("job-1");
    expect(mocks.buildSweepSummary).toHaveBeenCalledWith(1, [singleResult]);
    expect(mocks.sweepDedicatedPaymentAddresses).not.toHaveBeenCalled();
    expect(result).toEqual(summary);
  });

  it("uses batch sweep mode when payload does not include jobId", async () => {
    const summary = {
      scanned: 5,
      swept: 3,
      pending: 2,
      failed: 0,
      results: [],
    };
    mocks.sweepDedicatedPaymentAddresses.mockResolvedValue(summary);

    const result = await executeSweepCommand({ limit: 25 });

    expect(mocks.sweepDedicatedPaymentAddresses).toHaveBeenCalledWith(25);
    expect(mocks.sweepDedicatedPaymentAddressForJob).not.toHaveBeenCalled();
    expect(result).toEqual(summary);
  });
});
