"use client";

import { ReportDocument } from "@/lib/types/domain";

interface ReportCardProps {
  report: ReportDocument;
  reportUrl: string;
}

export function ReportCard({ report, reportUrl }: ReportCardProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Combined Report</h2>
        <a
          href={reportUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-cyan-500 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/10"
        >
          Download PDF
        </a>
      </div>

      <div className="grid gap-3 text-sm text-zinc-200 md:grid-cols-2">
        <p>Pump Tokens Traded: {report.pumpTokensTraded}</p>
        <p>Style: {report.styleClassification}</p>
        <p>Buys: {report.buyCount}</p>
        <p>Sells: {report.sellCount}</p>
        <p>SOL Spent: {report.solSpent}</p>
        <p>SOL Received: {report.solReceived}</p>
        <p>Estimated PnL: {report.estimatedPnlSol} SOL</p>
        <p>Best Trade: {report.bestTrade}</p>
      </div>

      <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm leading-relaxed text-zinc-200">
        {report.summary}
      </p>

      {report.walletPersonality ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
            Wallet Personality
          </p>
          <p className="mt-1 text-base font-semibold text-cyan-200">
            {report.walletPersonality}
          </p>
          {report.walletSecondaryPersonality ? (
            <p className="mt-1 text-sm text-zinc-300">
              Secondary influence: {report.walletSecondaryPersonality}
            </p>
          ) : null}
          {report.walletModifiers?.length ? (
            <p className="mt-2 text-sm text-zinc-300">
              Modifiers: {report.walletModifiers.join(", ")}
            </p>
          ) : null}
          {report.narrativeSummary ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-200">
              {report.narrativeSummary}
            </p>
          ) : null}
        </div>
      ) : null}

      {report.behaviorPatterns?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
            Behavior Patterns
          </p>
          <ul className="space-y-1 text-sm text-zinc-200">
            {report.behaviorPatterns.map((pattern) => (
              <li key={pattern}>- {pattern}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.funObservations?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
            Fun Observations
          </p>
          <ul className="space-y-1 text-sm text-zinc-200">
            {report.funObservations.map((observation) => (
              <li key={observation}>- {observation}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.memorableMoments?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
            Memorable Moments
          </p>
          <ul className="space-y-1 text-sm text-zinc-200">
            {report.memorableMoments.map((moment) => (
              <li key={moment}>- {moment}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.keyEvents?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
            Key Events
          </p>
          <ul className="space-y-2 text-sm text-zinc-200">
            {report.keyEvents.map((event, index) => (
              <li
                key={`${event.type}-${event.signature}-${index}`}
                className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">
                  {event.type.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-zinc-200">{event.tradeContext}</p>
                <p className="mt-1 text-zinc-400">{event.interpretation}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.storyBeats?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
            Video Story Beats
          </p>
          <ul className="space-y-1 text-sm text-zinc-200">
            {report.storyBeats.map((beat) => (
              <li key={beat}>- {beat}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs text-zinc-300">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="py-2">Time (UTC)</th>
              <th className="py-2">Symbol</th>
              <th className="py-2">Side</th>
              <th className="py-2">Token</th>
              <th className="py-2">SOL</th>
            </tr>
          </thead>
          <tbody>
            {report.timeline.slice(-15).map((item) => (
              <tr key={`${item.signature}-${item.timestamp}`} className="border-b border-zinc-900">
                <td className="py-2">
                  {new Date(item.timestamp * 1000).toISOString().slice(0, 19)}
                </td>
                <td className="py-2">{item.symbol}</td>
                <td className="py-2 uppercase">{item.side}</td>
                <td className="py-2">{item.tokenAmount.toFixed(4)}</td>
                <td className="py-2">{item.solAmount.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
