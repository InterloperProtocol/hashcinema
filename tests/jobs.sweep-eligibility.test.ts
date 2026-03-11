import { isSweepEligibleStatus } from "@/lib/jobs/repository";
import { JobStatus } from "@/lib/types/domain";
import { describe, expect, it } from "vitest";

describe("sweep eligibility by job status", () => {
  it("keeps failed jobs sweep-eligible for revenue recovery", () => {
    expect(isSweepEligibleStatus("failed")).toBe(true);
  });

  it("matches expected sweep eligibility matrix", () => {
    const expectations: Array<[JobStatus, boolean]> = [
      ["awaiting_payment", false],
      ["payment_detected", true],
      ["payment_confirmed", true],
      ["processing", true],
      ["complete", true],
      ["failed", true],
    ];

    for (const [status, expected] of expectations) {
      expect(isSweepEligibleStatus(status)).toBe(expected);
    }
  });
});

