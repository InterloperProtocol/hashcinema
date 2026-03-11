import {
  createJob,
  findRecentReusableJob,
  rollbackUnpaidJob,
} from "@/lib/jobs/repository";
import { ensurePaymentAddressSubscribedToHeliusWebhook } from "@/lib/helius/webhook-subscriptions";
import { logger } from "@/lib/logging/logger";
import { lamportsToSol } from "@/lib/payments/solana-pay";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request-ip";
import { PackageType } from "@/lib/types/domain";
import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const createJobSchema = z.object({
  wallet: z.string().min(32).max(64),
  packageType: z.enum(["1d", "2d", "3d"]),
});

function isValidWallet(wallet: string): boolean {
  try {
    new PublicKey(wallet);
    return true;
  } catch {
    return false;
  }
}

const JOB_RATE_LIMIT_RULES = [
  { name: "jobs_per_minute", windowSec: 60, limit: 5 },
  { name: "jobs_per_hour", windowSec: 60 * 60, limit: 20 },
] as const;

function createJobResponse(input: {
  jobId: string;
  priceSol: number;
  paymentAddress: string;
  requiredLamports: number;
  reused: boolean;
}) {
  return {
    jobId: input.jobId,
    priceSol: input.priceSol,
    paymentAddress: input.paymentAddress,
    amountSol: lamportsToSol(input.requiredLamports),
    reused: input.reused,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    if (!isValidWallet(parsed.data.wallet)) {
      return NextResponse.json(
        { error: "Invalid Solana wallet address" },
        { status: 400 },
      );
    }

    const ip = getRequestIp(request);
    const rateLimit = await enforceRateLimit({
      scope: "api_jobs_post",
      key: `${ip}:${parsed.data.wallet.toLowerCase()}`,
      rules: [...JOB_RATE_LIMIT_RULES],
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfterSec: rateLimit.retryAfterSec,
          rule: rateLimit.exceededRule,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSec),
          },
        },
      );
    }

    const reusableJob = await findRecentReusableJob({
      wallet: parsed.data.wallet,
      packageType: parsed.data.packageType as PackageType,
      maxAgeMinutes: 20,
    });

    if (reusableJob) {
      await ensurePaymentAddressSubscribedToHeliusWebhook(
        reusableJob.paymentAddress,
      );

      return NextResponse.json(
        createJobResponse({
          jobId: reusableJob.jobId,
          priceSol: reusableJob.priceSol,
          paymentAddress: reusableJob.paymentAddress,
          requiredLamports: reusableJob.requiredLamports,
          reused: true,
        }),
      );
    }

    const job = await createJob({
      wallet: parsed.data.wallet,
      packageType: parsed.data.packageType as PackageType,
    });

    try {
      const subscription = await ensurePaymentAddressSubscribedToHeliusWebhook(
        job.paymentAddress,
      );
      logger.info("helius_webhook_address_subscribed", {
        component: "api_jobs",
        stage: "create_job",
        jobId: job.jobId,
        paymentAddress: job.paymentAddress,
        webhookId: subscription.webhookId,
        createdWebhook: subscription.created,
        alreadySubscribed: subscription.alreadySubscribed,
      });
    } catch (error) {
      const rollback = await rollbackUnpaidJob(job.jobId);
      const message = error instanceof Error ? error.message : "Unknown error";

      logger.error("job_create_webhook_subscription_failed", {
        component: "api_jobs",
        stage: "create_job",
        jobId: job.jobId,
        paymentAddress: job.paymentAddress,
        errorCode: "webhook_subscription_failed",
        errorMessage: message,
        rolledBack: rollback.rolledBack,
      });

      return NextResponse.json(
        {
          error:
            "Failed to subscribe payment address to webhook. Please retry job creation.",
          message,
          rolledBack: rollback.rolledBack,
        },
        { status: rollback.rolledBack ? 503 : 500 },
      );
    }

    return NextResponse.json(
      createJobResponse({
        jobId: job.jobId,
        priceSol: job.priceSol,
        paymentAddress: job.paymentAddress,
        requiredLamports: job.requiredLamports,
        reused: false,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create job", message },
      { status: 500 },
    );
  }
}
