import { analyzeSeedWalletProfile } from "@/lib/analytics";
import {
  adaptWalletAnalysisToLegacyArtifacts,
  buildFallbackAnalysisFromLegacyArtifacts,
} from "@/lib/analytics/legacy-adapter";
import { walletAnalysisResultSchema } from "@/lib/analytics/schemas";

describe("legacy adapter bridge", () => {
  it("maps v2 analytics result into legacy report/story contracts", async () => {
    const analysis = await analyzeSeedWalletProfile("chaotic-overtrader");
    if (analysis.normalizedTrades[0]) {
      analysis.normalizedTrades[0].image = "https://cdn.example.com/seed-0.png";
      analysis.normalizedTrades[0].name = "Seed Token 0";
    }

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
    expect(mapped.report.timeline[0]?.image).toBe("https://cdn.example.com/seed-0.png");
    expect(mapped.story.timeline[0]?.image).toBe("https://cdn.example.com/seed-0.png");
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
    expect(fallback.normalizedTrades[0]?.image).toBe(mapped.report.timeline[0]?.image ?? undefined);
  });
});
