"use client";

import { ReportDocument } from "@/lib/types/domain";

interface ReportCardProps {
  report: ReportDocument;
  reportUrl: string;
}

function formatUsd(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function chainLabel(chain: ReportDocument["subjectChain"]): string {
  switch (chain) {
    case "solana":
      return "Solana";
    case "ethereum":
      return "Ethereum";
    case "bsc":
      return "BNB Chain";
    case "base":
      return "Base";
    default:
      return "Unknown chain";
  }
}

export function ReportCard({ report, reportUrl }: ReportCardProps) {
  const isTokenVideo = report.subjectKind === "token_video";
  const summary = report.summary || report.narrativeSummary || "No summary yet.";

  if (isTokenVideo) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Token Card</p>
            <h2>
              {report.subjectName ?? report.subjectSymbol ?? "Memecoin"} /{" "}
              {report.styleLabel ?? report.styleClassification}
            </h2>
          </div>
          <a
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
            className="button button-secondary"
          >
            Download PDF
          </a>
        </div>

        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Address</span>
              <strong>{report.subjectAddress ?? report.wallet}</strong>
            </div>
            <p className="route-summary compact">{chainLabel(report.subjectChain)}</p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Runtime</span>
              <strong>{report.durationSeconds ?? 0} seconds</strong>
            </div>
            <p className="route-summary compact">
              {report.styleLabel ?? report.styleClassification}
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Market cap</span>
              <strong>{formatUsd(report.marketSnapshot?.marketCapUsd)}</strong>
            </div>
            <p className="route-summary compact">
              Liquidity {formatUsd(report.marketSnapshot?.liquidityUsd)}
            </p>
          </article>
        </div>

        <div className="summary-card">
          <span>Summary</span>
          <p>{summary}</p>
        </div>

        {report.subjectDescription ? (
          <div className="summary-card">
            <span>Description</span>
            <p>{report.subjectDescription}</p>
          </div>
        ) : null}

        {report.storyBeats?.length ? (
          <div className="mini-list">
            {report.storyBeats.map((beat) => (
              <article key={beat} className="mini-item-card">
                <div>
                  <span>Beat</span>
                  <strong>{beat}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {report.tokenLinks?.length ? (
          <div className="button-row">
            {report.tokenLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="button button-secondary"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  const personality =
    report.walletPersonality || report.styleClassification || "Unclassified";
  const modifiers = report.walletModifiers?.length
    ? report.walletModifiers.join(", ")
    : "None detected";

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Combined Report</p>
          <h2>The Dossier</h2>
        </div>
        <a
          href={reportUrl}
          target="_blank"
          rel="noreferrer"
          className="button button-secondary"
        >
          Download PDF
        </a>
      </div>

      <div className="mini-list">
        <article className="mini-item-card">
          <div>
            <span>Wallet</span>
            <strong>{report.wallet}</strong>
          </div>
        </article>
        <article className="mini-item-card">
          <div>
            <span>Persona</span>
            <strong>{personality}</strong>
          </div>
          {report.walletSecondaryPersonality ? (
            <p className="route-summary compact">
              Secondary: {report.walletSecondaryPersonality}
            </p>
          ) : null}
        </article>
        <article className="mini-item-card">
          <div>
            <span>Modifiers</span>
            <strong>{modifiers}</strong>
          </div>
        </article>
      </div>

      <div className="summary-card">
        <span>Summary</span>
        <p>{summary}</p>
      </div>
    </section>
  );
}
