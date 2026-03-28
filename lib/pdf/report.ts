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

  page.drawText(
    report.subjectKind === "token_video"
      ? "HASHCINEMA TOKEN CARD"
      : "HASHCINEMA DOSSIER",
    {
    x: 40,
    y: 800,
    size: 22,
    font: bold,
    color: rgb(0.08, 0.1, 0.15),
    },
  );

  const subjectLine =
    report.subjectKind === "token_video"
      ? `Token: ${report.subjectName ?? report.subjectSymbol ?? "n/a"}`
      : `Wallet Address: ${report.wallet}`;

  page.drawText(toPdfSafeText(subjectLine, "Subject: n/a"), {
    x: 40,
    y: 770,
    size: 11,
    font,
    color: rgb(0.2, 0.22, 0.28),
  });

  let cursorY = 745;
  const metaLines =
    report.subjectKind === "token_video"
      ? [
          report.subjectSymbol ? `Ticker: ${report.subjectSymbol}` : null,
          report.subjectChain ? `Chain: ${report.subjectChain}` : null,
          report.styleLabel ? `Style: ${report.styleLabel}` : null,
          report.durationSeconds ? `Runtime: ${report.durationSeconds}s` : null,
        ].filter(Boolean) as string[]
      : [
          `Personality: ${report.walletPersonality ?? report.styleClassification ?? "Unclassified"}`,
          report.walletSecondaryPersonality
            ? `Secondary: ${report.walletSecondaryPersonality}`
            : null,
          report.walletModifiers?.length
            ? `Modifiers: ${report.walletModifiers.slice(0, 4).join(", ")}`
            : null,
          `Window: last ${report.rangeDays} day(s)`,
        ].filter(Boolean) as string[];

  metaLines.forEach((line, idx) => {
    page.drawText(toPdfSafeText(line, "n/a"), {
      x: 40,
      y: lineY(cursorY, idx, 14),
      size: 11,
      font,
      color: rgb(0.2, 0.22, 0.28),
    });
  });

  cursorY = lineY(cursorY, metaLines.length, 18);

  page.drawText("Summary", {
    x: 40,
    y: cursorY,
    size: 14,
    font: bold,
    color: rgb(0.08, 0.1, 0.15),
  });

  cursorY -= 16;
  const summaryLines = wrapText(
    toPdfSafeText(report.summary, "No summary available."),
    78,
  );
  summaryLines.slice(0, 8).forEach((line, idx) => {
    page.drawText(line, {
      x: 40,
      y: lineY(cursorY, idx, 14),
      size: 11,
      font,
      color: rgb(0.1, 0.12, 0.16),
    });
  });

  cursorY = lineY(cursorY, summaryLines.length, 14) - 8;

  const highlights = [
    ...(report.funObservations ?? []),
    ...(report.memorableMoments ?? []),
  ]
    .filter(Boolean)
    .slice(0, 6);

  if (highlights.length) {
    page.drawText("Highlights", {
      x: 40,
      y: cursorY,
      size: 12,
      font: bold,
      color: rgb(0.08, 0.1, 0.15),
    });

    cursorY -= 16;
    highlights.forEach((line, idx) => {
      page.drawText(toPdfSafeText(`- ${line}`, "n/a"), {
        x: 40,
        y: lineY(cursorY, idx, 14),
        size: 10,
        font,
        color: rgb(0.16, 0.18, 0.24),
      });
    });

    cursorY = lineY(cursorY, highlights.length, 14) - 8;
  }

  const beats = report.storyBeats?.slice(0, 4) ?? [];
  if (beats.length) {
    page.drawText("Story Beats", {
      x: 40,
      y: cursorY,
      size: 12,
      font: bold,
      color: rgb(0.08, 0.1, 0.15),
    });

    cursorY -= 16;
    beats.forEach((line, idx) => {
      page.drawText(toPdfSafeText(`- ${line}`, "n/a"), {
        x: 40,
        y: lineY(cursorY, idx, 14),
        size: 10,
        font,
        color: rgb(0.16, 0.18, 0.24),
      });
    });
  }

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
