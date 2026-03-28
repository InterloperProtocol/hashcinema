import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getEnv } from "@/lib/env";
import { dispatchSingleJob } from "@/lib/jobs/dispatch";
import { createX402PaidTokenVideoJob } from "@/lib/jobs/repository";
import { logger } from "@/lib/logging/logger";
import { resolveMemecoinMetadata } from "@/lib/memecoins/metadata";
import { resolvePackage } from "@/lib/packages";
import { PackageType, VideoStyleId } from "@/lib/types/domain";
import { getHashArtX402Server, usdToUsdcAtomic } from "@/lib/x402/hashart";

export const runtime = "nodejs";

const agentVideoRequestSchema = z
  .object({
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
    requestedPrompt: z.string().max(240).optional(),
    packageType: z.enum(["1d", "2d"]).optional(),
    durationSeconds: z.union([z.literal(30), z.literal(60)]).optional(),
  })
  .refine((value) => value.packageType || value.durationSeconds, {
    message: "Either packageType or durationSeconds is required.",
    path: ["packageType"],
  });

function buildResourceUrl(): string {
  const env = getEnv();
  return new URL("/api/x402/video", env.APP_BASE_URL).toString();
}

async function buildRequirements(input: {
  packageType: PackageType;
  priceUsdc: number;
  durationSeconds: number;
}) {
  const server = getHashArtX402Server();
  return server.buildRequirements({
    amountAtomic: usdToUsdcAtomic(input.priceUsdc),
    resourceUrl: buildResourceUrl(),
    description: `HashCinema ${input.durationSeconds}s memecoin video`,
    mimeType: "application/json",
    timeoutSeconds: 300,
  });
}

function build402Response(input: {
  error?: string;
  requirementsHeader: string;
  accepts: unknown[];
  resource: unknown;
  packageType: PackageType;
  rangeDays: number;
  priceSol: number;
  priceUsdc: number;
  durationSeconds: number;
}) {
  return NextResponse.json(
    {
      error: input.error ?? "Payment required",
      paymentMethod: "x402_usdc",
      network: "solana",
      currency: "USDC",
      package: {
        packageType: input.packageType,
        rangeDays: input.rangeDays,
        durationSeconds: input.durationSeconds,
        priceSol: input.priceSol,
        priceUsdc: input.priceUsdc,
      },
      accepts: input.accepts,
      resource: input.resource,
    },
    {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": input.requirementsHeader,
      },
    },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = agentVideoRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const pkg = resolvePackage({
      packageType: parsed.data.packageType ?? null,
      durationSeconds: parsed.data.durationSeconds ?? null,
    });
    if (!pkg) {
      return NextResponse.json(
        { error: "Unsupported package request" },
        { status: 400 },
      );
    }

    const resolved = await resolveMemecoinMetadata({
      address: parsed.data.tokenAddress,
      chain: parsed.data.chain,
    });

    const server = getHashArtX402Server();
    const requirements = await buildRequirements({
      packageType: pkg.packageType,
      priceUsdc: pkg.priceUsdc,
      durationSeconds: pkg.videoSeconds,
    });
    const requirementsHeader = server.encodeRequirements(requirements);
    const paymentSignature = request.headers.get("payment-signature")?.trim();

    if (!paymentSignature) {
      return build402Response({
        requirementsHeader,
        accepts: requirements.accepts,
        resource: requirements.resource,
        packageType: pkg.packageType,
        rangeDays: pkg.rangeDays,
        priceSol: pkg.priceSol,
        priceUsdc: pkg.priceUsdc,
        durationSeconds: pkg.videoSeconds,
      });
    }

    const accepted = requirements.accepts[0];
    if (!accepted) {
      throw new Error("No x402 payment requirements were generated");
    }

    const settlement = await server.settlePayment(paymentSignature, accepted);
    if (!settlement.success || !settlement.transaction) {
      return build402Response({
        error: settlement.errorReason || "Payment settlement failed",
        requirementsHeader,
        accepts: requirements.accepts,
        resource: requirements.resource,
        packageType: pkg.packageType,
        rangeDays: pkg.rangeDays,
        priceSol: pkg.priceSol,
        priceUsdc: pkg.priceUsdc,
        durationSeconds: pkg.videoSeconds,
      });
    }

    const job = await createX402PaidTokenVideoJob({
      tokenAddress: parsed.data.tokenAddress,
      packageType: pkg.packageType,
      subjectChain: resolved.chain,
      subjectName: resolved.name,
      subjectSymbol: resolved.symbol,
      subjectImage: resolved.image,
      subjectDescription: resolved.description,
      transaction: settlement.transaction,
      stylePreset: parsed.data.stylePreset as VideoStyleId,
      requestedPrompt: parsed.data.requestedPrompt?.trim() || null,
    });

    const dispatch = await dispatchSingleJob(job.jobId);

    return NextResponse.json(
      {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        dispatchStatus: dispatch.status,
        package: {
          packageType: job.packageType,
          rangeDays: job.rangeDays,
          durationSeconds: job.videoSeconds,
          priceSol: job.priceSol,
          priceUsdc: job.priceUsdc,
        },
        subject: {
          address: job.subjectAddress ?? job.wallet,
          chain: job.subjectChain ?? resolved.chain,
          name: job.subjectName ?? null,
          symbol: job.subjectSymbol ?? null,
          image: job.subjectImage ?? null,
          stylePreset: job.stylePreset ?? null,
        },
        payment: {
          method: "x402_usdc",
          network: settlement.network,
          currency: "USDC",
          amountUsd: job.priceUsdc,
          transaction: settlement.transaction,
          payer: settlement.payer ?? null,
        },
        urls: {
          job: `${getEnv().APP_BASE_URL}/job/${job.jobId}`,
          status: `${getEnv().APP_BASE_URL}/api/jobs/${job.jobId}`,
          report: `${getEnv().APP_BASE_URL}/api/report/${job.jobId}`,
          video: `${getEnv().APP_BASE_URL}/api/video/${job.jobId}`,
        },
      },
      {
        status: dispatch.status === "dispatched" ? 200 : 202,
        headers: {
          "X-X402-Transaction": settlement.transaction,
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("x402_video_job_failed", {
      component: "api_x402_video",
      stage: "create_paid_job",
      errorCode: "x402_video_job_failed",
      errorMessage: message,
    });

    const status =
      message.includes("valid Solana mint") ||
      message.includes("EVM-formatted") ||
      message.includes("support the Solana chain")
        ? 400
        : 500;

    return NextResponse.json(
      { error: "Failed to create x402 video job", message },
      { status },
    );
  }
}
