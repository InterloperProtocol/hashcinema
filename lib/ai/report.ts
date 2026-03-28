import { openRouterJson } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logging/logger";
import { ReportDocument } from "@/lib/types/domain";

interface SummaryResponse {
  summary: string;
}

function clampWordCount(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return `${words.slice(0, maxWords).join(" ")}...`;
}

export function buildFallbackReportSummary(
  report: Omit<ReportDocument, "summary" | "downloadUrl">,
): string {
  if (report.subjectKind === "token_video") {
    const chain = report.subjectChain ? `${report.subjectChain} ` : "";
    const subject =
      report.subjectName && report.subjectSymbol
        ? `${report.subjectName} (${report.subjectSymbol})`
        : report.subjectSymbol ?? report.subjectAddress ?? "This token";
    const style = report.styleLabel ?? report.styleClassification ?? "token trailer";
    const marketCap = report.marketSnapshot?.marketCapUsd
      ? `Market cap snapshot: ${report.marketSnapshot.marketCapUsd.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          notation: "compact",
          maximumFractionDigits: 2,
        })}.`
      : "";
    const liquidity = report.marketSnapshot?.liquidityUsd
      ? `Liquidity snapshot: ${report.marketSnapshot.liquidityUsd.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          notation: "compact",
          maximumFractionDigits: 2,
        })}.`
      : "";
    const narrative = report.narrativeSummary?.trim();
    const moment = report.funObservations?.[0] ?? report.memorableMoments?.[0] ?? null;

    return clampWordCount(
      [
        `${subject} gets a ${style.toLowerCase()} treatment instead of a wallet recap.`,
        `${chain}The contract itself is the protagonist, and the cut stays focused on one memecoin from open to final frame.`,
        marketCap,
        liquidity,
        moment ?? "The token is framed like a moving trading card built for sharing.",
        narrative ? `Direction: ${narrative}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      140,
    );
  }

  const walletShort = `${report.wallet.slice(0, 4)}...${report.wallet.slice(-4)}`;
  const personality = report.walletPersonality ?? report.styleClassification ?? "Unclassified";
  const secondPersonality = report.walletSecondaryPersonality
    ? ` with a ${report.walletSecondaryPersonality} side quest`
    : "";
  const modifiers = report.walletModifiers?.slice(0, 2).join(" + ") ?? "";
  const narrative = report.narrativeSummary?.trim();
  const moment = report.funObservations?.[0] ?? report.memorableMoments?.[0] ?? null;
  const tradeStats = `Trade stats: spent ${report.solSpent.toFixed(4)} SOL, received ${report.solReceived.toFixed(4)} SOL. Best trade: ${report.bestTrade}. Worst trade: ${report.worstTrade}.`;
  const outro =
    report.estimatedPnlSol >= 0
      ? "The window closed with the plot mostly intact."
      : "PnL caught strays, but the lore got louder.";
  const base = [
    `Wallet ${walletShort} just ran a ${personality} arc${secondPersonality} over the last ${report.rangeDays} day(s).`,
    tradeStats,
    modifiers ? `Modifier stack: ${modifiers}.` : "",
    moment ?? "The tape refused to be normal.",
    narrative ? `Storyline: ${narrative}` : "Storyline: chaos met conviction and kept the camera rolling.",
    outro,
  ]
    .filter(Boolean)
    .join(" ");

  return clampWordCount(base, 140);
}

export async function generateReportSummary(
  report: Omit<ReportDocument, "summary" | "downloadUrl">,
): Promise<string> {
  try {
    const response = await openRouterJson<SummaryResponse>({
      temperature: 0.1,
      maxTokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are a trench cinema narrator. Use ONLY the JSON facts provided. Keep it memetic, funny, viral-tuned, and written as natural language (not a stat dump). If the subjectKind is token_video, write about the memecoin itself rather than a wallet. Do not invent any trades, tokens, timestamps, prices, or chain data. Output strictly JSON with one key: summary.",
        },
        {
          role: "user",
          content: `Generate a concise dossier summary (80-140 words) from these facts:\n${JSON.stringify(
            report,
          )}`,
        },
      ],
    });

    const summary = response.summary?.trim();
    if (summary) {
      return summary;
    }
  } catch (error) {
    logger.warn("report_summary_openrouter_failed_fallback", {
      component: "ai_report",
      stage: "generate_summary",
      errorCode: "report_summary_openrouter_failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return buildFallbackReportSummary(report);
}
