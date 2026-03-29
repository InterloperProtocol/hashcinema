import {
  createPromptVideoJob,
  createTokenVideoJob,
  findRecentReusableTokenJob,
  rollbackUnpaidJob,
} from "@/lib/jobs/repository";
import { detectSourceMediaProvider } from "@/lib/cinema/sourceMedia";
import { ensurePaymentAddressSubscribedToHeliusWebhook } from "@/lib/helius/webhook-subscriptions";
import { logger } from "@/lib/logging/logger";
import { resolveMemecoinMetadata } from "@/lib/memecoins/metadata";
import { getPackageConfig } from "@/lib/packages";
import { lamportsToSol } from "@/lib/payments/solana-pay";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request-ip";
import {
  CinemaExperience,
  CinemaPricingMode,
  CinemaVisibility,
  JobDocument,
  PackageType,
  RequestedTokenChain,
  VideoStyleId,
} from "@/lib/types/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCrossmintSessionFromRequest } from "@/lib/crossmint/server";
import { getCinemaPackageConfig } from "@/lib/cinema/config";

export const runtime = "nodejs";

const styleSchema = z.enum([
  "hyperflow_assembly",
  "trading_card",
  "trench_neon",
  "mythic_poster",
  "glass_signal",
]);

const sharedCinemaSchema = z.object({
  packageType: z.enum(["1d", "2d"]),
  stylePreset: styleSchema.optional(),
  requestedPrompt: z.string().max(4_000).optional(),
  audioEnabled: z.boolean().optional(),
  pricingMode: z.enum(["legacy", "public", "private"]).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  experience: z
    .enum([
      "legacy",
      "hashcinema",
      "trenchcinema",
      "funcinema",
      "familycinema",
      "musicvideo",
      "recreator",
    ])
    .optional(),
});

const tokenVideoSchema = sharedCinemaSchema.extend({
  requestKind: z.literal("token_video").optional(),
  tokenAddress: z.string().min(32).max(64),
  chain: z.enum(["auto", "solana", "ethereum", "bsc", "base"]).default("auto"),
  subjectDescription: z.string().max(1_200).optional(),
});

const promptVideoSchema = sharedCinemaSchema.extend({
  requestKind: z.enum([
    "generic_cinema",
    "bedtime_story",
    "music_video",
    "scene_recreation",
  ]),
  subjectName: z.string().min(2).max(120),
  subjectDescription: z.string().max(4_000).optional(),
  sourceMediaUrl: z.string().url().optional(),
  sourceTranscript: z.string().max(20_000).optional(),
});

const createJobSchema = z.union([tokenVideoSchema, promptVideoSchema]);

const JOB_RATE_LIMIT_RULES = [
  { name: "jobs_per_minute", windowSec: 60, limit: 5 },
  { name: "jobs_per_hour", windowSec: 60 * 60, limit: 20 },
] as const;

type CreateJobPayload = z.infer<typeof createJobSchema>;

interface CreateJobResponse {
  jobId: string;
  priceSol: number;
  paymentAddress: string;
  amountSol: number;
  tokenAddress?: string | null;
  chain?: RequestedTokenChain | null;
  subjectName?: string | null;
  subjectSymbol?: string | null;
  subjectImage?: string | null;
  stylePreset?: VideoStyleId | null;
  pricingMode?: CinemaPricingMode;
  visibility?: CinemaVisibility;
  experience?: CinemaExperience;
}

function isPromptPayload(payload: CreateJobPayload): payload is z.infer<typeof promptVideoSchema> {
  return (
    payload.requestKind === "generic_cinema" ||
    payload.requestKind === "bedtime_story" ||
    payload.requestKind === "music_video" ||
    payload.requestKind === "scene_recreation"
  );
}

function resolvePricing(input: {
  packageType: PackageType;
  pricingMode?: CinemaPricingMode;
}) {
  if (input.pricingMode === "public" || input.pricingMode === "private") {
    return getCinemaPackageConfig({
      packageType: input.packageType,
      pricingMode: input.pricingMode,
    });
  }

  return getPackageConfig(input.packageType);
}

function normalizeVisibility(input: {
  pricingMode?: CinemaPricingMode;
  visibility?: CinemaVisibility;
  requestKind?: CreateJobPayload["requestKind"];
}): CinemaVisibility {
  if (input.visibility === "private" || input.pricingMode === "private") {
    return "private";
  }

  if (input.requestKind === "bedtime_story") {
    return "private";
  }

  return "public";
}

function normalizeExperience(input: {
  experience?: CinemaExperience;
  requestKind?: CreateJobPayload["requestKind"];
  visibility: CinemaVisibility;
}): CinemaExperience {
  if (
    input.experience === "hashcinema" ||
    input.experience === "trenchcinema" ||
    input.experience === "funcinema" ||
    input.experience === "familycinema" ||
    input.experience === "musicvideo" ||
    input.experience === "recreator"
  ) {
    return input.experience;
  }

  if (input.requestKind === "token_video") {
    return "trenchcinema";
  }

  if (input.requestKind === "bedtime_story") {
    return "familycinema";
  }

  if (input.requestKind === "music_video") {
    return "musicvideo";
  }

  if (input.requestKind === "scene_recreation") {
    return "recreator";
  }

  return input.visibility === "private" ? "funcinema" : "hashcinema";
}

function createJobResponse(input: {
  job: JobDocument;
  chain?: RequestedTokenChain | null;
}): CreateJobResponse {
  return {
    jobId: input.job.jobId,
    priceSol: input.job.priceSol,
    paymentAddress: input.job.paymentAddress,
    amountSol: lamportsToSol(input.job.requiredLamports),
    tokenAddress: input.job.subjectAddress ?? null,
    chain: input.chain ?? (input.job.subjectChain ?? null),
    subjectName: input.job.subjectName ?? null,
    subjectSymbol: input.job.subjectSymbol ?? null,
    subjectImage: input.job.subjectImage ?? null,
    stylePreset: input.job.stylePreset ?? null,
    pricingMode: input.job.pricingMode ?? "legacy",
    visibility: input.job.visibility ?? "public",
    experience: input.job.experience ?? "legacy",
  };
}

async function ensurePrivateSession(request: NextRequest) {
  const session = await getCrossmintSessionFromRequest(request);
  if (!session?.userId) {
    return null;
  }

  return session;
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

    const payload = parsed.data;
    const ip = getRequestIp(request);
    const rateLimitKey = isPromptPayload(payload)
      ? `${ip}:${payload.subjectName.toLowerCase()}`
      : `${ip}:${payload.tokenAddress.toLowerCase()}`;

    const rateLimit = await enforceRateLimit({
      scope: "api_jobs_post",
      key: rateLimitKey,
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

    const pricingMode = payload.pricingMode ?? "legacy";
    const visibility = normalizeVisibility({
      pricingMode,
      visibility: payload.visibility,
      requestKind: payload.requestKind,
    });
    const experience = normalizeExperience({
      experience: payload.experience,
      requestKind: payload.requestKind,
      visibility,
    });

    let creatorId: string | null = null;
    if (visibility === "private") {
      const session = await ensurePrivateSession(request);
      if (!session) {
        return NextResponse.json(
          { error: "Crossmint login required for private cinema routes." },
          { status: 401 },
        );
      }
      creatorId = session.userId;
    }

    const pkg = resolvePricing({
      packageType: payload.packageType as PackageType,
      pricingMode,
    });

    if (!isPromptPayload(payload)) {
      const resolved = await resolveMemecoinMetadata({
        address: payload.tokenAddress,
        chain: payload.chain,
      });

      const canReuseLegacy =
        pricingMode === "legacy" &&
        visibility === "public" &&
        (payload.requestKind ?? "token_video") === "token_video";

      if (canReuseLegacy) {
        const reusableJob = await findRecentReusableTokenJob({
          tokenAddress: payload.tokenAddress,
          packageType: payload.packageType as PackageType,
          subjectChain: resolved.chain,
          stylePreset: (payload.stylePreset ?? "hyperflow_assembly") as VideoStyleId,
          requestedPrompt: payload.requestedPrompt?.trim() || null,
          maxAgeMinutes: 20,
        });

        if (reusableJob) {
          await ensurePaymentAddressSubscribedToHeliusWebhook(reusableJob.paymentAddress);
          return NextResponse.json(
            createJobResponse({
              job: reusableJob,
              chain: reusableJob.subjectChain ?? resolved.chain,
            }),
          );
        }
      }

      const job = await createTokenVideoJob({
        tokenAddress: payload.tokenAddress,
        packageType: payload.packageType as PackageType,
        subjectChain: resolved.chain,
        subjectName: resolved.name,
        subjectSymbol: resolved.symbol,
        subjectImage: resolved.image,
        subjectDescription:
          payload.subjectDescription?.trim() ||
          resolved.description,
        stylePreset: (payload.stylePreset ?? "hyperflow_assembly") as VideoStyleId,
        requestedPrompt: payload.requestedPrompt?.trim() || null,
        audioEnabled: payload.audioEnabled ?? false,
        pricingMode,
        visibility,
        experience,
        creatorId,
        priceSol: pkg.priceSol,
        priceUsdc: pkg.priceUsdc,
        videoSeconds: pkg.videoSeconds,
        rangeDays: pkg.rangeDays,
      });

      try {
        await ensurePaymentAddressSubscribedToHeliusWebhook(job.paymentAddress);
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
          job,
          chain: job.subjectChain ?? resolved.chain,
        }),
      );
    }

    const job = await createPromptVideoJob({
      requestKind: payload.requestKind,
      packageType: payload.packageType as PackageType,
      subjectName: payload.subjectName,
      subjectDescription: payload.subjectDescription?.trim() || null,
      sourceMediaUrl: payload.sourceMediaUrl?.trim() || null,
      sourceMediaProvider: detectSourceMediaProvider(payload.sourceMediaUrl?.trim() || null),
      stylePreset:
        payload.stylePreset ??
        (payload.requestKind === "bedtime_story" ? "mythic_poster" : "hyperflow_assembly"),
      requestedPrompt: payload.requestedPrompt?.trim() || null,
      sourceTranscript: payload.sourceTranscript?.trim() || null,
      audioEnabled:
        detectSourceMediaProvider(payload.sourceMediaUrl?.trim() || null)
          ? false
          : payload.requestKind === "bedtime_story" ||
              payload.requestKind === "music_video" ||
              payload.requestKind === "scene_recreation"
            ? payload.audioEnabled ?? true
            : payload.audioEnabled ?? false,
      pricingMode,
      visibility,
      experience,
      creatorId,
      priceSol: pkg.priceSol,
      priceUsdc: pkg.priceUsdc,
      videoSeconds: pkg.videoSeconds,
      rangeDays: pkg.rangeDays,
    });

    try {
      await ensurePaymentAddressSubscribedToHeliusWebhook(job.paymentAddress);
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
        job,
        chain: null,
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
