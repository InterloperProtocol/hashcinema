import { analyzeWalletProfile } from "../lib/analytics";
import {
  adaptWalletAnalysisToLegacyArtifacts,
  buildFallbackAnalysisFromLegacyArtifacts,
} from "../lib/analytics/legacy-adapter";
import { walletAnalysisResultSchema } from "../lib/analytics/schemas";
import { generateReportSummary } from "../lib/ai/report";
import { getEnv } from "../lib/env";
import { fetchRecentTransactionsByWallet } from "../lib/helius/fetch-transactions";
import {
  beginJobProcessing,
  getJob,
  markJobFailed,
  updateJob,
  updateJobProgress,
  updateJobStatus,
  upsertReport,
  upsertVideo,
} from "../lib/jobs/repository";
import { logger } from "../lib/logging/logger";
import { generateReportPdf } from "../lib/pdf/report";
import { extractPumpTrades } from "../lib/pump/filter";
import {
  uploadBufferToStorage,
  uploadRemoteFileToStorage,
} from "../lib/storage/upload";
import { JobDocument, ReportDocument, WalletStory } from "../lib/types/domain";
import { buildAndRenderVideo } from "../lib/video/pipeline";
import { computeAnalyticsFromTrades } from "../lib/analytics/compute";
import { recoverJobIfNeeded } from "../lib/jobs/recovery";
import { publishCompletedJobToGoonBook } from "../lib/social/goonbook-publisher";
import { resolveMemecoinMetadata } from "../lib/memecoins/metadata";
import { buildTokenVideoArtifacts } from "../lib/memecoins/story";

type AnalyticsEngineMode = ReturnType<typeof getEnv>["ANALYTICS_ENGINE_MODE"];
const ANALYTICS_STAGE_TIMEOUT_MS = 4 * 60_000;
const LEGACY_STAGE_TIMEOUT_MS = 5 * 60_000;
const STAGE_HEARTBEAT_MS = 15_000;

function toRangeHours(rangeDays: number): 24 | 48 | 72 {
  if (rangeDays === 1) return 24;
  if (rangeDays === 2) return 48;
  if (rangeDays === 3) return 72;
  throw new Error(`Unsupported analysis rangeDays: ${rangeDays}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function timedStage<T>(
  context: {
    jobId: string;
    wallet: string;
  },
  stage: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  logger.info("pipeline_stage_started", {
    component: "worker",
    stage,
    jobId: context.jobId,
    wallet: context.wallet,
  });

  try {
    const result = await fn();
    logger.info("pipeline_stage_completed", {
      component: "worker",
      stage,
      jobId: context.jobId,
      wallet: context.wallet,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    logger.error("pipeline_stage_failed", {
      component: "worker",
      stage,
      jobId: context.jobId,
      wallet: context.wallet,
      durationMs: Date.now() - started,
      errorCode: "stage_failure",
      errorMessage: errorMessage(error),
    });
    throw error;
  }
}

function stageTimedOutMessage(stage: string, timeoutMs: number): string {
  return `Stage '${stage}' timed out after ${timeoutMs}ms`;
}

async function withTimeout<T>(
  input: { stage: string; timeoutMs: number; operation: () => Promise<T> },
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(stageTimedOutMessage(input.stage, input.timeoutMs)));
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([input.operation(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function withProgressHeartbeat<T>(
  input: {
    jobId: string;
    progress:
      | "fetching_transactions"
      | "filtering_pump_activity"
      | "generating_report"
      | "generating_script"
      | "generating_video"
      | "uploading_assets";
    operation: () => Promise<T>;
  },
): Promise<T> {
  const interval = setInterval(() => {
    void updateJobProgress(input.jobId, input.progress).catch((error) => {
      logger.warn("pipeline_stage_heartbeat_failed", {
        component: "worker",
        stage: input.progress,
        jobId: input.jobId,
        errorCode: "pipeline_stage_heartbeat_failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    });
  }, STAGE_HEARTBEAT_MS);

  try {
    return await input.operation();
  } finally {
    clearInterval(interval);
  }
}

async function computeLegacyArtifacts(input: {
  jobId: string;
  wallet: string;
  rangeDays: number;
  packageType: WalletStory["packageType"];
  durationSeconds: number;
}): Promise<{
  report: Omit<ReportDocument, "summary" | "downloadUrl">;
  story: WalletStory;
}> {
  const transactions = await timedStage(
    { jobId: input.jobId, wallet: input.wallet },
    "legacy_fetch_wallet_transactions",
    () => fetchRecentTransactionsByWallet(input.wallet, input.rangeDays),
  );

  const trades = await timedStage(
    { jobId: input.jobId, wallet: input.wallet },
    "legacy_filter_pump_activity",
    () => extractPumpTrades(input.wallet, transactions),
  );

  return timedStage(
    { jobId: input.jobId, wallet: input.wallet },
    "legacy_compute_analytics",
    async () =>
      withTimeout({
        stage: "legacy_compute_analytics",
        timeoutMs: LEGACY_STAGE_TIMEOUT_MS,
        operation: async () =>
          computeAnalyticsFromTrades({
            jobId: input.jobId,
            wallet: input.wallet,
            rangeDays: input.rangeDays,
            packageType: input.packageType,
            durationSeconds: input.durationSeconds,
            trades,
          }),
      }),
  );
}

async function uploadRenderedAssets(input: {
  jobId: string;
  context: { jobId: string; wallet: string };
  rendered: { videoUrl: string; thumbnailUrl: string | null };
  report: ReportDocument;
}): Promise<{
  storedVideoUrl: string;
  reportUrl: string;
  thumbnailUrl: string | null;
}> {
  return withProgressHeartbeat({
    jobId: input.jobId,
    progress: "uploading_assets",
    operation: async () => {
      await updateJobProgress(input.jobId, "uploading_assets");
      const [pdfBuffer, storedVideoUrl] = await Promise.all([
        timedStage(input.context, "generate_report_pdf", async () =>
          generateReportPdf(input.report),
        ),
        timedStage(input.context, "upload_video_asset", async () =>
          uploadRemoteFileToStorage({
            sourceUrl: input.rendered.videoUrl,
            storagePath: `videos/${input.jobId}.mp4`,
            contentType: "video/mp4",
          }),
        ),
      ]);

      const reportUrl = await timedStage(input.context, "upload_report_asset", async () =>
        uploadBufferToStorage({
          storagePath: `reports/${input.jobId}.pdf`,
          contentType: "application/pdf",
          data: pdfBuffer,
        }),
      );

      let thumbnailUrl: string | null = null;
      if (input.rendered.thumbnailUrl) {
        thumbnailUrl = await timedStage(
          input.context,
          "upload_thumbnail_asset",
          async () =>
            uploadRemoteFileToStorage({
              sourceUrl: input.rendered.thumbnailUrl!,
              storagePath: `videos/${input.jobId}-thumbnail.jpg`,
              contentType: "image/jpeg",
            }),
        );
      }

      return {
        storedVideoUrl,
        reportUrl,
        thumbnailUrl,
      };
    },
  });
}

async function processTokenVideoJob(input: {
  job: JobDocument;
}): Promise<void> {
  const tokenAddress = input.job.subjectAddress ?? input.job.wallet;
  const context = {
    jobId: input.job.jobId,
    wallet: tokenAddress,
  };

  await updateJobProgress(input.job.jobId, "fetching_transactions");
  const token = await timedStage(context, "resolve_token_metadata", () =>
    resolveMemecoinMetadata({
      address: tokenAddress,
      chain: input.job.subjectChain ?? "auto",
    }),
  );

  await updateJob(input.job.jobId, {
    subjectAddress: token.address,
    subjectChain: token.chain,
    subjectName: token.name,
    subjectSymbol: token.symbol,
    subjectImage: token.image,
    subjectDescription: token.description,
  });

  const enrichedJob: JobDocument = {
    ...input.job,
    subjectAddress: token.address,
    subjectChain: token.chain,
    subjectName: token.name,
    subjectSymbol: token.symbol,
    subjectImage: token.image,
    subjectDescription: token.description,
  };

  await updateJobProgress(input.job.jobId, "generating_report");
  const computed = buildTokenVideoArtifacts({
    job: enrichedJob,
    token,
  });

  const summary = await timedStage(context, "generate_report_summary", async () =>
    generateReportSummary(computed.report),
  );

  const report: ReportDocument = {
    ...computed.report,
    summary,
    downloadUrl: null,
  };

  await upsertReport(report);

  await updateJobProgress(input.job.jobId, "generating_script");
  await updateJobProgress(input.job.jobId, "generating_video");
  await upsertVideo({
    jobId: input.job.jobId,
    videoUrl: null,
    thumbnailUrl: null,
    duration: enrichedJob.videoSeconds,
    renderStatus: "queued",
  });

  const rendered = await withProgressHeartbeat({
    jobId: input.job.jobId,
    progress: "generating_video",
    operation: async () =>
      timedStage(context, "build_and_render_video", async () =>
        buildAndRenderVideo({
          jobId: input.job.jobId,
          walletStory: computed.story,
        }),
      ),
  });

  const { storedVideoUrl, reportUrl, thumbnailUrl } = await uploadRenderedAssets({
    jobId: input.job.jobId,
    context,
    rendered,
    report,
  });

  await Promise.all([
    upsertReport({
      ...report,
      downloadUrl: reportUrl,
    }),
    upsertVideo({
      jobId: input.job.jobId,
      videoUrl: storedVideoUrl,
      thumbnailUrl,
      duration: enrichedJob.videoSeconds,
      renderStatus: "ready",
    }),
    updateJobStatus(input.job.jobId, "complete", {
      progress: "complete",
      errorCode: null,
      errorMessage: null,
    }),
  ]);
}

export async function processJob(jobId: string): Promise<void> {
  const env = getEnv();
  const mode: AnalyticsEngineMode = env.ANALYTICS_ENGINE_MODE;

  const current = await getJob(jobId);
  if (!current) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (current.status === "complete") {
    return;
  }

  if (await recoverJobIfNeeded(jobId)) {
    return;
  }

  const begin = await beginJobProcessing(jobId, {
    staleAfterMs: env.JOB_PROCESSING_STALE_MS,
  });
  if (!begin.job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (!begin.acquired) {
    await recoverJobIfNeeded(jobId);
    return;
  }

  const job = begin.job;
  const context = { jobId: job.jobId, wallet: job.wallet };

  try {
    if (job.requestKind === "token_video") {
      await processTokenVideoJob({ job });

      try {
        const publication = await publishCompletedJobToGoonBook(jobId);
        if (publication.status === "failed") {
          logger.warn("goonbook_publication_attempt_failed", {
            component: "worker",
            stage: "publish_goonbook",
            jobId,
            errorCode: "goonbook_publication_attempt_failed",
            errorMessage: publication.reason ?? "Unknown GoonBook publication error",
          });
        }
      } catch (publicationError) {
        logger.warn("goonbook_publication_attempt_crashed", {
          component: "worker",
          stage: "publish_goonbook",
          jobId,
          errorCode: "goonbook_publication_attempt_crashed",
          errorMessage: errorMessage(publicationError),
        });
      }

      return;
    }

    let computed:
      | {
          report: Omit<ReportDocument, "summary" | "downloadUrl">;
          story: WalletStory;
        }
      | undefined;
    let usedLegacyFallback = false;

    if (mode === "legacy") {
      await updateJobProgress(jobId, "fetching_transactions");
      computed = await computeLegacyArtifacts({
        jobId: job.jobId,
        wallet: job.wallet,
        rangeDays: job.rangeDays,
        packageType: job.packageType,
        durationSeconds: job.videoSeconds,
      });
    } else {
      await updateJobProgress(jobId, "fetching_transactions");
      await updateJobProgress(jobId, "filtering_pump_activity");
      await updateJobProgress(jobId, "generating_report");

      try {
        const analysis = await withProgressHeartbeat({
          jobId,
          progress: "generating_report",
          operation: async () =>
            timedStage(context, "v2_analyze_wallet_profile", async () =>
              withTimeout({
                stage: "v2_analyze_wallet_profile",
                timeoutMs: ANALYTICS_STAGE_TIMEOUT_MS,
                operation: async () => {
                  const result = await analyzeWalletProfile({
                    wallet: job.wallet,
                    rangeHours: toRangeHours(job.rangeDays),
                  });
                  return walletAnalysisResultSchema.parse(result);
                },
              }),
            ),
        });

        computed = await timedStage(context, "v2_adapt_legacy_contract", async () =>
          adaptWalletAnalysisToLegacyArtifacts({
            jobId: job.jobId,
            wallet: job.wallet,
            rangeDays: job.rangeDays,
            packageType: job.packageType,
            durationSeconds: job.videoSeconds,
            analysis,
            analysisEngine: "v2",
          }),
        );
      } catch (error) {
        if (mode === "v2") {
          throw error;
        }

        usedLegacyFallback = true;
        logger.warn("analytics_v2_failed_falling_back_to_legacy", {
          component: "worker",
          stage: "v2_analyze_wallet_profile",
          jobId: job.jobId,
          wallet: job.wallet,
          errorCode: "analytics_v2_failed",
          errorMessage: errorMessage(error),
        });

        await updateJobProgress(jobId, "fetching_transactions");
        computed = await computeLegacyArtifacts({
          jobId: job.jobId,
          wallet: job.wallet,
          rangeDays: job.rangeDays,
          packageType: job.packageType,
          durationSeconds: job.videoSeconds,
        });
      }
    }

    if (!computed) {
      throw new Error("Failed to compute analytics artifacts");
    }

    await updateJobProgress(jobId, "generating_report");
    const summary = await timedStage(context, "generate_report_summary", async () =>
      generateReportSummary(computed!.report),
    );

    const report: ReportDocument = {
      ...computed.report,
      summary,
      downloadUrl: null,
    };

    if (usedLegacyFallback) {
      const fallbackAnalysis = walletAnalysisResultSchema.parse(
        buildFallbackAnalysisFromLegacyArtifacts({
          report: computed.report,
          summary,
          story: computed.story,
          rangeHours: toRangeHours(job.rangeDays),
        }),
      );

      report.analysisV2 = {
        schemaVersion: "wallet-analysis.v1",
        generatedAt: new Date().toISOString(),
        engine: "legacy-fallback",
        payload: fallbackAnalysis,
      };
    }

    await upsertReport(report);

    await updateJobProgress(jobId, "generating_script");
    await updateJobProgress(jobId, "generating_video");
    await upsertVideo({
      jobId,
      videoUrl: null,
      thumbnailUrl: null,
      duration: job.videoSeconds,
      renderStatus: "queued",
    });

    const rendered = await withProgressHeartbeat({
      jobId,
      progress: "generating_video",
      operation: async () =>
        timedStage(context, "build_and_render_video", async () =>
          buildAndRenderVideo({
            jobId: job.jobId,
            walletStory: computed!.story,
          }),
        ),
    });

    const { storedVideoUrl, reportUrl, thumbnailUrl } = await uploadRenderedAssets({
      jobId,
      context,
      rendered,
      report,
    });

    await Promise.all([
      upsertReport({
        ...report,
        downloadUrl: reportUrl,
      }),
      upsertVideo({
        jobId,
        videoUrl: storedVideoUrl,
        thumbnailUrl,
        duration: job.videoSeconds,
        renderStatus: "ready",
      }),
      updateJobStatus(jobId, "complete", {
        progress: "complete",
        errorCode: null,
        errorMessage: null,
      }),
    ]);

    try {
      const publication = await publishCompletedJobToGoonBook(jobId);
      if (publication.status === "failed") {
        logger.warn("goonbook_publication_attempt_failed", {
          component: "worker",
          stage: "publish_goonbook",
          jobId,
          errorCode: "goonbook_publication_attempt_failed",
          errorMessage: publication.reason ?? "Unknown GoonBook publication error",
        });
      }
    } catch (publicationError) {
      logger.warn("goonbook_publication_attempt_crashed", {
        component: "worker",
        stage: "publish_goonbook",
        jobId,
        errorCode: "goonbook_publication_attempt_crashed",
        errorMessage: errorMessage(publicationError),
      });
    }
  } catch (error) {
    const message = errorMessage(error);
    await markJobFailed(jobId, "pipeline_error", message);
    throw error;
  }
}

if (process.argv[1]?.includes("process-job") && process.argv[2]) {
  processJob(process.argv[2]).catch((error) => {
    logger.error("worker_cli_failed", {
      component: "worker",
      stage: "process_job_cli",
      jobId: process.argv[2],
      errorCode: "worker_cli_failed",
      errorMessage: errorMessage(error),
    });
    process.exit(1);
  });
}
