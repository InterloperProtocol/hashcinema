import Link from "next/link";

import { HyperflowAssemblyScaffold } from "@/components/shell/HyperflowAssemblyScaffold";
import {
  listCompletedJobArtifacts,
  listCompletedJobArtifactsByWallet,
} from "@/lib/jobs/repository";

export const dynamic = "force-dynamic";

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function buildDescription(report?: {
  summary?: string;
  narrativeSummary?: string;
  funObservations?: string[];
}): string {
  const base =
    report?.summary ||
    report?.narrativeSummary ||
    report?.funObservations?.[0] ||
    "A completed HashCinema memecoin cut.";
  return truncate(base, 150);
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }> | { token?: string };
}) {
  const params = (await Promise.resolve(searchParams)) ?? {};
  const tokenQuery = params.token?.trim() ?? "";
  const jobs = tokenQuery
    ? await listCompletedJobArtifactsByWallet(tokenQuery, 12)
    : await listCompletedJobArtifacts(12);

  const leftRail = (
    <div className="rail-stack">
      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Gallery</p>
            <h2>Completed token cuts</h2>
          </div>
        </div>
        <p className="route-summary">
          Finished memecoin videos, token cards, and thumbnail frames. Search by mint or
          contract address to isolate one asset.
        </p>
      </section>
    </div>
  );

  const rightRail = (
    <div className="rail-stack">
      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Browse</p>
            <h2>Search by address</h2>
          </div>
        </div>
        <form method="GET" className="form-stack">
          <div className="field">
            <span>Mint or contract</span>
            <input
              name="token"
              defaultValue={tokenQuery}
              placeholder="Paste token address"
            />
          </div>
          <div className="button-row">
            <button type="submit" className="button button-primary">
              Search
            </button>
            {tokenQuery ? (
              <Link href="/gallery" className="button button-secondary">
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );

  return (
    <div className="cinema-shell cinema-noise min-h-[100dvh] overflow-hidden px-4 py-6 text-[#fff1dc] md:px-8 md:py-8">
      <HyperflowAssemblyScaffold leftRail={leftRail} rightRail={rightRail}>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">HashCinema Gallery</p>
              <h1>Recent memecoin videos</h1>
            </div>
            <div className="button-row">
              <Link href="/" className="button button-secondary">
                Back to homepage
              </Link>
            </div>
          </div>
        </section>

        {jobs.length ? (
          <section className="module-grid-3x2">
            {jobs.map(({ job, report }) => {
              const description = buildDescription(report ?? undefined);
              const title =
                report?.subjectName ??
                report?.subjectSymbol ??
                report?.walletPersonality ??
                "HashCinema";
              const subline =
                report?.subjectSymbol ??
                report?.subjectAddress ??
                report?.wallet ??
                job.wallet;

              return (
                <Link
                  key={job.jobId}
                  href={`/job/${job.jobId}`}
                  className="surface-card module-tile"
                >
                  <p className="eyebrow">{job.videoSeconds}s cut</p>
                  <h2>{title}</h2>
                  <p>{description}</p>
                  <div className="module-preview">
                    <span>Address</span>
                    <strong>{truncate(subline, 24)}</strong>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : (
          <section className="panel">
            <p className="route-summary">
              {tokenQuery
                ? `No completed jobs found for ${tokenQuery}.`
                : "No completed token videos yet. Generate the first one and it will show up here."}
            </p>
          </section>
        )}
      </HyperflowAssemblyScaffold>
    </div>
  );
}
