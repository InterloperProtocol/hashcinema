import { analyzeSeedWalletProfile } from "@/lib/analytics";
import {
  adaptWalletAnalysisToLegacyArtifacts,
  buildFallbackAnalysisFromLegacyArtifacts,
} from "@/lib/analytics/legacy-adapter";
import { walletAnalysisResultSchema } from "@/lib/analytics/schemas";

describe("legacy adapter bridge", () => {
  it("maps v2 analytics result into legacy report/story contracts", async () => {
    const analysis = await analyzeSeedWalletProfile("chaotic-overtrader");
    const mapped = adaptWalletAnalysisToLegacyArtifacts({
      jobId: "job-test",
      wallet: analysis.wallet,
      rangeDays: 1,
      packageType: "1d",
      durationSeconds: 30,
      analysis,
      analysisEngine: "v2",
    });

    expect(mapped.report.jobId).toBe("job-test");
    expect(mapped.report.walletPersonality).toBe(analysis.personality.primary.displayName);
    expect(mapped.report.analysisV2?.schemaVersion).toBe("wallet-analysis.v1");
    expect(mapped.story.analytics.pumpTokensTraded).toBe(mapped.report.pumpTokensTraded);
  });

  it("builds a schema-valid fallback analysis payload from legacy artifacts", async () => {
    const analysis = await analyzeSeedWalletProfile("pump-chaser");
    const mapped = adaptWalletAnalysisToLegacyArtifacts({
      jobId: "job-fallback",
      wallet: analysis.wallet,
      rangeDays: 2,
      packageType: "2d",
      durationSeconds: 60,
      analysis,
      analysisEngine: "v2",
    });

    const fallback = buildFallbackAnalysisFromLegacyArtifacts({
      report: mapped.report,
      summary: "Legacy fallback summary",
      story: mapped.story,
      rangeHours: 48,
    });

    expect(walletAnalysisResultSchema.parse(fallback)).toEqual(fallback);
    expect(fallback.writersRoomSelections.contentSource).toBe("fallback-only");
  });
});

