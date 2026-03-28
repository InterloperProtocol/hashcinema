import {
  createTokenVideoJob,
  findRecentReusableTokenJob,
  rollbackUnpaidJob,
} from "@/lib/jobs/repository";
import { ensurePaymentAddressSubscribedToHeliusWebhook } from "@/lib/helius/webhook-subscriptions";
import { logger } from "@/lib/logging/logger";
import { resolveMemecoinMetadata } from "@/lib/memecoins/metadata";
import { lamportsToSol } from "@/lib/payments/solana-pay";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request-ip";
import { PackageType, RequestedTokenChain, VideoStyleId } from "@/lib/types/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const createJobSchema = z.object({
  tokenAddress: z.string().min(32).max(64),
  chain: z.enum(["auto", "solana", "ethereum", "bsc", "base"]).default("auto"),
  stylePreset: z
    .enum([
      "hyperflow_assembly",
      "trading_card",
      "trench_neon",
      "mythic_poster",
      "glass_signal",
    ])
    .default("hyperflow_assembly"),
  packageType: z.enum(["1d", "2d"]),
  requestedPrompt: z.string().max(240).optional(),
});

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
  tokenAddress: string;
  chain: RequestedTokenChain;
  subjectName?: string | null;
  subjectSymbol?: string | null;
  subjectImage?: string | null;
  stylePreset?: VideoStyleId | null;
}) {
  return {
    jobId: input.jobId,
    priceSol: input.priceSol,
    paymentAddress: input.paymentAddress,
    amountSol: lamportsToSol(input.requiredLamports),
    reused: input.reused,
    tokenAddress: input.tokenAddress,
    chain: input.chain,
    subjectName: input.subjectName ?? null,
    subjectSymbol: input.subjectSymbol ?? null,
    subjectImage: input.subjectImage ?? null,
    stylePreset: input.stylePreset ?? null,
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

    const ip = getRequestIp(request);
    const rateLimit = await enforceRateLimit({
      scope: "api_jobs_post",
      key: `${ip}:${parsed.data.tokenAddress.toLowerCase()}`,
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

    const resolved = await resolveMemecoinMetadata({
      address: parsed.data.tokenAddress,
      chain: parsed.data.chain,
    });

    const reusableJob = await findRecentReusableTokenJob({
      tokenAddress: parsed.data.tokenAddress,
      packageType: parsed.data.packageType as PackageType,
      subjectChain: resolved.chain,
      stylePreset: parsed.data.stylePreset as VideoStyleId,
      requestedPrompt: parsed.data.requestedPrompt?.trim() || null,
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
          tokenAddress: reusableJob.subjectAddress ?? reusableJob.wallet,
          chain: reusableJob.subjectChain ?? resolved.chain,
          subjectName: reusableJob.subjectName ?? null,
          subjectSymbol: reusableJob.subjectSymbol ?? null,
          subjectImage: reusableJob.subjectImage ?? null,
          stylePreset: reusableJob.stylePreset ?? null,
        }),
      );
    }

    const job = await createTokenVideoJob({
      tokenAddress: parsed.data.tokenAddress,
      packageType: parsed.data.packageType as PackageType,
      subjectChain: resolved.chain,
      subjectName: resolved.name,
      subjectSymbol: resolved.symbol,
      subjectImage: resolved.image,
      subjectDescription: resolved.description,
      stylePreset: parsed.data.stylePreset as VideoStyleId,
      requestedPrompt: parsed.data.requestedPrompt?.trim() || null,
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
        tokenAddress: job.subjectAddress ?? job.wallet,
        chain: job.subjectChain ?? resolved.chain,
        subjectName: job.subjectName ?? null,
        subjectSymbol: job.subjectSymbol ?? null,
        subjectImage: job.subjectImage ?? null,
        stylePreset: job.stylePreset ?? null,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("valid Solana mint") ||
      message.includes("EVM-formatted") ||
      message.includes("support the Solana chain")
        ? 400
        : 500;
    return NextResponse.json(
      { error: "Failed to create job", message },
      { status },
    );
  }
}
