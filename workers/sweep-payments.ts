import { getEnv } from "@/lib/env";
import { getSolanaConnection } from "@/lib/helius/connection";
import {
  getJob,
  listSweepCandidateJobs,
  markSweepResult,
} from "@/lib/jobs/repository";
import { logger } from "@/lib/logging/logger";
import { derivePaymentKeypair } from "@/lib/payments/dedicated-address";
import { getRevenueWalletAddress } from "@/lib/payments/solana-pay";
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

export interface SweepJobResult {
  jobId: string;
  status: "swept" | "pending" | "failed";
  signature?: string;
  sweptLamports?: number;
  reason?: string;
}

export interface SweepSummary {
  scanned: number;
  swept: number;
  pending: number;
  failed: number;
  results: SweepJobResult[];
}

const FALLBACK_FEE_LAMPORTS = 5_000;

export function computeSweepableLamports(
  balanceLamports: number,
  feeLamports: number,
  minLamports: number,
): number {
  const transferable = Math.max(0, balanceLamports - feeLamports);
  if (transferable < minLamports) {
    return 0;
  }
  return transferable;
}

export function buildSweepSummary(
  scanned: number,
  results: SweepJobResult[],
): SweepSummary {
  return {
    scanned,
    swept: results.filter((result) => result.status === "swept").length,
    pending: results.filter((result) => result.status === "pending").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

function getSweepRuntimeConfig(): {
  minLamports: number;
  revenueWallet: PublicKey;
} {
  const env = getEnv();
  return {
    minLamports: Math.max(0, env.SWEEP_MIN_LAMPORTS),
    revenueWallet: new PublicKey(getRevenueWalletAddress()),
  };
}

async function sweepSingleJob(params: {
  jobId: string;
  paymentIndex: number;
  paymentAddress: string;
  minLamports: number;
  revenueWallet: PublicKey;
}): Promise<SweepJobResult> {
  const keypair = derivePaymentKeypair(params.paymentIndex);
  const expectedAddress = keypair.publicKey.toBase58();
  if (expectedAddress !== params.paymentAddress) {
    const reason = "derived_address_mismatch";
    await markSweepResult({
      jobId: params.jobId,
      status: "failed",
      error: reason,
    });
    return {
      jobId: params.jobId,
      status: "failed",
      reason,
    };
  }

  try {
    const connection = getSolanaConnection();
    const balanceLamports = await connection.getBalance(
      keypair.publicKey,
      "confirmed",
    );
    if (balanceLamports <= 0) {
      await markSweepResult({
        jobId: params.jobId,
        status: "pending",
        error: null,
      });

      return {
        jobId: params.jobId,
        status: "pending",
        sweptLamports: 0,
        reason: "empty_balance",
      };
    }

    const latest = await connection.getLatestBlockhash("confirmed");
    const feeProbeTx = new Transaction({
      feePayer: keypair.publicKey,
      recentBlockhash: latest.blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: params.revenueWallet,
        lamports: 1,
      }),
    );

    const feeResponse = await connection.getFeeForMessage(
      feeProbeTx.compileMessage(),
      "confirmed",
    );
    const feeLamports = feeResponse.value ?? FALLBACK_FEE_LAMPORTS;
    const sweepableLamports = computeSweepableLamports(
      balanceLamports,
      feeLamports,
      params.minLamports,
    );

    if (sweepableLamports <= 0) {
      await markSweepResult({
        jobId: params.jobId,
        status: "pending",
        error: null,
      });

      return {
        jobId: params.jobId,
        status: "pending",
        reason: "below_minimum",
      };
    }

    const sweepTx = new Transaction({
      feePayer: keypair.publicKey,
      recentBlockhash: latest.blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: params.revenueWallet,
        lamports: sweepableLamports,
      }),
    );

    sweepTx.sign(keypair);

    const signature = await connection.sendRawTransaction(sweepTx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );

    const result = {
      kind: "swept" as const,
      signature,
      sweepableLamports,
    };

    await markSweepResult({
      jobId: params.jobId,
      status: "swept",
      signature: result.signature,
      sweptLamportsDelta: result.sweepableLamports,
      error: null,
    });

    return {
      jobId: params.jobId,
      status: "swept",
      signature: result.signature,
      sweptLamports: result.sweepableLamports,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "sweep_failed";
    await markSweepResult({
      jobId: params.jobId,
      status: "failed",
      error: reason,
    });
    return {
      jobId: params.jobId,
      status: "failed",
      reason,
    };
  }
}

export async function sweepDedicatedPaymentAddressForJob(
  jobId: string,
): Promise<SweepJobResult> {
  const { minLamports, revenueWallet } = getSweepRuntimeConfig();
  const job = await getJob(jobId);
  if (!job) {
    return {
      jobId,
      status: "failed",
      reason: "job_not_found",
    };
  }

  if (!job.paymentIndex || !job.paymentAddress) {
    return {
      jobId,
      status: "failed",
      reason: "missing_payment_routing",
    };
  }

  return sweepSingleJob({
    jobId: job.jobId,
    paymentIndex: job.paymentIndex,
    paymentAddress: job.paymentAddress,
    minLamports,
    revenueWallet,
  });
}

export async function sweepDedicatedPaymentAddresses(
  requestedLimit?: number,
): Promise<SweepSummary> {
  const env = getEnv();
  const limit = Math.max(
    1,
    Math.min(
      200,
      requestedLimit && Number.isFinite(requestedLimit)
        ? Math.floor(requestedLimit)
        : env.SWEEP_BATCH_LIMIT,
    ),
  );
  const { minLamports, revenueWallet } = getSweepRuntimeConfig();
  const candidates = await listSweepCandidateJobs(limit);

  logger.info("sweep_run_started", {
    component: "worker",
    stage: "sweep",
    scanned: candidates.length,
    minLamports,
    limit,
  });

  const results: SweepJobResult[] = [];
  for (const job of candidates) {
    if (!job.paymentIndex || !job.paymentAddress) {
      continue;
    }

    const result = await sweepSingleJob({
      jobId: job.jobId,
      paymentIndex: job.paymentIndex,
      paymentAddress: job.paymentAddress,
      minLamports,
      revenueWallet,
    });
    results.push(result);
  }

  const summary = buildSweepSummary(candidates.length, results);

  logger.info("sweep_run_completed", {
    component: "worker",
    stage: "sweep",
    scanned: summary.scanned,
    swept: summary.swept,
    pending: summary.pending,
    failed: summary.failed,
  });

  return summary;
}
