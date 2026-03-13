import { ReportDocument } from "@/lib/types/domain";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function lineY(startY: number, index: number, step = 18): number {
  return startY - index * step;
}

export function toPdfSafeText(
  value: string | number | null | undefined,
  fallback = "",
): string {
  const raw = String(value ?? "");
  const normalized = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length > 0) {
    return normalized;
  }

  return fallback;
}

export async function generateReportPdf(
  report: ReportDocument,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("HASHCINEMA Trading Report", {
    x: 40,
    y: 800,
    size: 22,
    font: bold,
    color: rgb(0.08, 0.1, 0.15),
  });

  page.drawText(toPdfSafeText(`Wallet: ${report.wallet}`, "Wallet: n/a"), {
    x: 40,
    y: 770,
    size: 11,
    font,
    color: rgb(0.2, 0.22, 0.28),
  });

  const metrics = [
    `Range Days: ${report.rangeDays}`,
    `Pump Tokens Traded: ${report.pumpTokensTraded}`,
    `Buys: ${report.buyCount}`,
    `Sells: ${report.sellCount}`,
    `SOL Spent: ${report.solSpent}`,
    `SOL Received: ${report.solReceived}`,
    `Estimated PnL (SOL): ${report.estimatedPnlSol}`,
    `Best Trade: ${report.bestTrade}`,
    `Worst Trade: ${report.worstTrade}`,
    `Style Classification: ${report.styleClassification}`,
  ];

  metrics.forEach((metric, idx) => {
    page.drawText(toPdfSafeText(metric, "n/a"), {
      x: 40,
      y: lineY(730, idx),
      size: 12,
      font,
    });
  });

  page.drawText("Summary", {
    x: 40,
    y: 525,
    size: 14,
    font: bold,
  });

  const summaryLines = wrapText(
    toPdfSafeText(report.summary, "No summary available."),
    78,
  );
  summaryLines.slice(0, 8).forEach((line, idx) => {
    page.drawText(line, {
      x: 40,
      y: lineY(505, idx, 15),
      size: 11,
      font,
      color: rgb(0.1, 0.12, 0.16),
    });
  });

  if (report.walletPersonality) {
    page.drawText(toPdfSafeText(`Wallet Personality: ${report.walletPersonality}`), {
      x: 40,
      y: 380,
      size: 11,
      font: bold,
      color: rgb(0.12, 0.16, 0.22),
    });
  }

  if (report.walletSecondaryPersonality) {
    page.drawText(toPdfSafeText(`Secondary: ${report.walletSecondaryPersonality}`), {
      x: 40,
      y: 364,
      size: 10,
      font,
      color: rgb(0.2, 0.24, 0.3),
    });
  }

  if (report.walletModifiers?.length) {
    const modifierLine = toPdfSafeText(
      `Modifiers: ${report.walletModifiers.slice(0, 4).join(", ")}`,
      "Modifiers: n/a",
    );
    page.drawText(modifierLine, {
      x: 40,
      y: 350,
      size: 10,
      font,
      color: rgb(0.2, 0.24, 0.3),
    });
  }

  if (report.keyEvents?.length) {
    page.drawText("Key Events", {
      x: 40,
      y: 330,
      size: 12,
      font: bold,
    });

    report.keyEvents.slice(0, 2).forEach((event, idx) => {
      const line = toPdfSafeText(
        `${event.type.replace(/_/g, " ")}: ${event.tradeContext}`,
        "event unavailable",
      ).slice(0, 96);
      page.drawText(line, {
        x: 40,
        y: lineY(314, idx, 14),
        size: 9,
        font,
        color: rgb(0.16, 0.18, 0.24),
      });
    });
  }

  page.drawText("Timeline (latest entries)", {
    x: 40,
    y: 275,
    size: 14,
    font: bold,
  });

  const timelineHeader = "Time (UTC)            Side   Symbol     Token Amt     SOL Amt";
  page.drawText(timelineHeader, {
    x: 40,
    y: 255,
    size: 10,
    font: bold,
  });

  report.timeline.slice(-8).forEach((item, idx) => {
    const date = new Date(item.timestamp * 1000).toISOString().slice(0, 19);
    const side = toPdfSafeText(item.side, "?").slice(0, 4);
    const symbol = toPdfSafeText(item.symbol, "?");
    const line = `${date}   ${side.padEnd(4)}   ${symbol
      .slice(0, 8)
      .padEnd(8)}   ${item.tokenAmount.toFixed(4).padStart(10)}   ${item.solAmount
      .toFixed(4)
      .padStart(8)}`;
    page.drawText(line, {
      x: 40,
      y: lineY(237, idx, 14),
      size: 9,
      font,
    });
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}
