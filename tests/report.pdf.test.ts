import { describe, expect, it } from "vitest";

import { generateReportPdf, toPdfSafeText } from "@/lib/pdf/report";
import { ReportDocument } from "@/lib/types/domain";

describe("generateReportPdf", () => {
  it("tolerates unicode report content", async () => {
    const report: ReportDocument = {
      jobId: "job-1",
      wallet: "wallet-1",
      rangeDays: 1,
      pumpTokensTraded: 1,
      buyCount: 1,
      sellCount: 1,
      solSpent: 1,
      solReceived: 2,
      estimatedPnlSol: 1,
      bestTrade: "スケッチ (+1.0 SOL)",
      worstTrade: "cafe (-0.2 SOL)",
      styleClassification: "Chaos",
      summary: "Token スケッチ outran cafe momentum and printed a wild reversal.",
      timeline: [
        {
          timestamp: 1_773_363_032,
          signature: "sig-1",
          mint: "mint-1",
          symbol: "スケッチ",
          side: "buy",
          tokenAmount: 123,
          solAmount: 1.5,
        },
      ],
      downloadUrl: null,
      keyEvents: [
        {
          type: "largest_gain",
          timestamp: 1_773_363_032,
          token: "PUMP",
          signature: "sig-1",
          tradeContext: "スケッチ moved first and asked questions later.",
          interpretation: "Largest gain.",
        },
      ],
    };

    const pdfBuffer = await generateReportPdf(report);

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });

  it("normalizes text into a WinAnsi-safe form", () => {
    expect(toPdfSafeText("cafe スケッチ")).toBe("cafe ????");
  });
});
