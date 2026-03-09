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
  getJob,
  markJobFailed,
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
import { ReportDocument, WalletStory } from "../lib/types/domain";
import { buildAndRenderVideo } from "../lib/video/pipeline";
import { computeAnalyticsFromTrades } from "../lib/analytics/compute";

type AnalyticsEngineMode = ReturnType<typeof getEnv>["ANALYTICS_ENGINE_MODE"];

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
      computeAnalyticsFromTrades({
        jobId: input.jobId,
        wallet: input.wallet,
        rangeDays: input.rangeDays,
        packageType: input.packageType,
        durationSeconds: input.durationSeconds,
        trades,
      }),
  );
}

export async function processJob(jobId: string): Promise<void> {
  const env = getEnv();
  const mode: AnalyticsEngineMode = env.ANALYTICS_ENGINE_MODE;

  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (job.status === "complete") {
    return;
  }

  if (job.status === "processing") {
    return;
  }

  if (job.status !== "payment_confirmed") {
    throw new Error(`Job ${jobId} cannot run before payment confirmation`);
  }

  const context = { jobId: job.jobId, wallet: job.wallet };

  try {
    await updateJobStatus(jobId, "processing", {
      progress: "fetching_transactions",
    });

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
        const analysis = await timedStage(context, "v2_analyze_wallet_profile", async () => {
          const result = await analyzeWalletProfile({
            wallet: job.wallet,
            rangeHours: toRangeHours(job.rangeDays),
          });
          return walletAnalysisResultSchema.parse(result);
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

    const rendered = await timedStage(context, "build_and_render_video", async () =>
      buildAndRenderVideo({
        jobId: job.jobId,
        walletStory: computed!.story,
      }),
    );

    await updateJobProgress(jobId, "uploading_assets");
    const [pdfBuffer, storedVideoUrl] = await Promise.all([
      timedStage(context, "generate_report_pdf", async () => generateReportPdf(report)),
      timedStage(context, "upload_video_asset", async () =>
        uploadRemoteFileToStorage({
          sourceUrl: rendered.videoUrl,
          storagePath: `videos/${jobId}.mp4`,
          contentType: "video/mp4",
        }),
      ),
    ]);

    const reportUrl = await timedStage(context, "upload_report_asset", async () =>
      uploadBufferToStorage({
        storagePath: `reports/${jobId}.pdf`,
        contentType: "application/pdf",
        data: pdfBuffer,
      }),
    );

    let thumbnailUrl: string | null = null;
    if (rendered.thumbnailUrl) {
      thumbnailUrl = await timedStage(context, "upload_thumbnail_asset", async () =>
        uploadRemoteFileToStorage({
          sourceUrl: rendered.thumbnailUrl!,
          storagePath: `videos/${jobId}-thumbnail.jpg`,
          contentType: "image/jpeg",
        }),
      );
    }

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

