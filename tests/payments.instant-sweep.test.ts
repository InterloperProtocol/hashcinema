import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@solana/web3.js";

const REVENUE_WALLET = "D1CRgh1Ty3yjDwN9CkwtsRWKmsmKQ2BbRbtKvCTfAN8Z";

const mocks = vi.hoisted(() => ({
  getJob: vi.fn(),
  listSweepCandidateJobs: vi.fn(),
  markSweepResult: vi.fn(),
  derivePaymentKeypair: vi.fn(),
  getSolanaConnection: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    SWEEP_MIN_LAMPORTS: 5_000,
    SWEEP_BATCH_LIMIT: 50,
  }),
}));

vi.mock("@/lib/jobs/repository", () => ({
  getJob: mocks.getJob,
  listSweepCandidateJobs: mocks.listSweepCandidateJobs,
  markSweepResult: mocks.markSweepResult,
}));

vi.mock("@/lib/payments/dedicated-address", () => ({
  derivePaymentKeypair: mocks.derivePaymentKeypair,
}));

vi.mock("@/lib/helius/connection", () => ({
  getSolanaConnection: mocks.getSolanaConnection,
}));

vi.mock("@/lib/payments/solana-pay", () => ({
  getRevenueWalletAddress: () => REVENUE_WALLET,
}));

import { sweepDedicatedPaymentAddressForJob } from "@/workers/sweep-payments";

describe("instant per-job sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns failed when job does not exist", async () => {
    mocks.getJob.mockResolvedValue(null);

    const result = await sweepDedicatedPaymentAddressForJob("missing-job");

    expect(result).toEqual({
      jobId: "missing-job",
      status: "failed",
      reason: "job_not_found",
    });
  });

  it("sweeps a single job directly to the revenue wallet", async () => {
    const keypair = Keypair.generate();
    const paymentAddress = keypair.publicKey.toBase58();

    mocks.getJob.mockResolvedValue({
      jobId: "job-1",
      paymentIndex: 42,
      paymentAddress,
    });
    mocks.derivePaymentKeypair.mockReturnValue(keypair);
    mocks.getSolanaConnection.mockReturnValue({
      getBalance: vi.fn().mockResolvedValue(100_000),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: "11111111111111111111111111111111",
        lastValidBlockHeight: 123,
      }),
      getFeeForMessage: vi.fn().mockResolvedValue({ value: 5_000 }),
      sendRawTransaction: vi.fn().mockResolvedValue("sig-123"),
      confirmTransaction: vi.fn().mockResolvedValue({}),
    });

    const result = await sweepDedicatedPaymentAddressForJob("job-1");

    expect(result.status).toBe("swept");
    expect(result.signature).toBe("sig-123");
    expect(result.sweptLamports).toBe(95_000);
    expect(mocks.markSweepResult).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        status: "swept",
        signature: "sig-123",
        sweptLamportsDelta: 95_000,
      }),
    );
  });
});
