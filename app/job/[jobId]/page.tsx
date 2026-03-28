"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { PaymentInstructionsCard } from "@/components/PaymentInstructionsCard";
import { ReportCard } from "@/components/ReportCard";
import { VideoPlayer } from "@/components/VideoPlayer";
import { HyperflowAssemblyScaffold } from "@/components/shell/HyperflowAssemblyScaffold";
import { FINAL_JOB_STATUSES } from "@/lib/constants";
import type { PaymentInstructions } from "@/lib/payments/instructions";
import { JobDocument, ReportDocument, VideoDocument } from "@/lib/types/domain";

interface JobApiPayload {
  job?: JobDocument;
  report?: ReportDocument | null;
  video?: VideoDocument | null;
  payment?: PaymentInstructions | null;
  error?: string;
  message?: string;
  warning?: string;
}

function statusLabel(status: JobDocument["status"], progress: JobDocument["progress"]) {
  if (status === "awaiting_payment") return "Waiting on the send";
  if (status === "payment_detected") return "Payment seen on-chain";
  if (status === "payment_confirmed") return "Payment locked";
  if (progress === "generating_report") return "Composing the token card";
  if (progress === "generating_video") return "Rendering the memecoin cut";
  if (status === "processing") return "In the studio";
  if (status === "complete") return "Premiere ready";
  return "Render failed";
}

function nextPollDelay(job: JobDocument | null, elapsedMs: number): number {
  if (elapsedMs >= 2 * 60 * 1000) {
    return 15000;
  }

  if (!job) {
    return 8000;
  }

  if (
    job.status === "awaiting_payment" ||
    job.status === "payment_detected" ||
    job.status === "payment_confirmed"
  ) {
    return 10000;
  }

  if (
    job.progress === "generating_script" ||
    job.progress === "generating_video" ||
    job.progress === "uploading_assets"
  ) {
    return 8000;
  }

  if (job.status === "processing") {
    return 5000;
  }

  return 10000;
}

function priceLabel(job: JobDocument): string {
  if (job.paymentMethod === "x402_usdc") {
    return `$${job.priceUsdc ?? 0} USDC`;
  }
  return `${job.priceSol} SOL`;
}

function chainLabel(chain: JobDocument["subjectChain"]): string {
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

export default function JobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [job, setJob] = useState<JobDocument | null>(null);
  const [report, setReport] = useState<ReportDocument | null>(null);
  const [video, setVideo] = useState<VideoDocument | null>(null);
  const [payment, setPayment] = useState<PaymentInstructions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const loadJob = useCallback(async (): Promise<JobDocument | null> => {
    const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    const payload = (await response.json()) as JobApiPayload;
    if (!response.ok) {
      throw new Error(payload.message ?? payload.error ?? "Failed to fetch job.");
    }
    setJob(payload.job ?? null);
    setReport(payload.report ?? null);
    setVideo(payload.video ?? null);
    setPayment(payload.payment ?? null);
    return payload.job ?? null;
  }, [jobId]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let cancelled = false;
    let consecutiveErrors = 0;
    const startedAt = Date.now();

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (cancelled) return;

      try {
        const latest = await loadJob();
        consecutiveErrors = 0;
        setError(null);

        if (latest && FINAL_JOB_STATUSES.includes(latest.status)) {
          return;
        }

        const elapsedMs = Date.now() - startedAt;
        schedule(nextPollDelay(latest, elapsedMs));
      } catch (pollError) {
        consecutiveErrors += 1;

        if (consecutiveErrors >= 3) {
          setError(
            pollError instanceof Error
              ? pollError.message
              : "Polling failed after repeated retries.",
          );
          return;
        }

        const elapsedMs = Date.now() - startedAt;
        const backoffDelay = Math.min(15000, 5000 + consecutiveErrors * 2000);
        schedule(Math.max(nextPollDelay(null, elapsedMs), backoffDelay));
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loadJob]);

  const retryFailedJob = useCallback(async () => {
    setIsRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? payload.error ?? "Failed to retry job.");
      }

      window.location.reload();
    } catch (retryError) {
      setError(
        retryError instanceof Error ? retryError.message : "Failed to retry job.",
      );
    } finally {
      setIsRetrying(false);
    }
  }, [jobId]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const publicUrl = `${window.location.origin}/job/${jobId}`;
    const tokenName = job?.subjectSymbol ?? job?.subjectName ?? "this memecoin";
    const text = `HashCinema just turned ${tokenName} into a cinematic token card.`;
    return `https://x.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(publicUrl)}`;
  }, [job?.subjectName, job?.subjectSymbol, jobId]);

  const leftRail = (
    <div className="rail-stack">
      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Job</p>
            <h2>{job?.subjectName ?? job?.subjectSymbol ?? "Memecoin render"}</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Address</span>
              <strong>{job?.subjectAddress ?? job?.wallet ?? jobId}</strong>
            </div>
            <p className="route-summary compact">{chainLabel(job?.subjectChain)}</p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Package</span>
              <strong>{job?.videoSeconds ?? 0}s runtime</strong>
            </div>
            <p className="route-summary compact">{job ? priceLabel(job) : "Loading"}</p>
          </article>
        </div>
      </section>
    </div>
  );

  const rightRail = (
    <div className="rail-stack">
      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h2>{job ? statusLabel(job.status, job.progress) : "Loading"}</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Progress</span>
              <strong>{job?.progress ?? "pending"}</strong>
            </div>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Checkout</span>
              <strong>
                {job?.paymentMethod === "x402_usdc" ? "x402 / USDC" : "Manual SOL"}
              </strong>
            </div>
          </article>
        </div>

        <div className="button-row">
          <Link className="button button-secondary" href="/">
            Create another
          </Link>
          <Link className="button button-secondary" href="/gallery">
            Open gallery
          </Link>
        </div>
      </section>

      {job?.status === "failed" ? (
        <section className="panel rail-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recovery</p>
              <h2>Retry render</h2>
            </div>
          </div>
          <p className="route-summary compact">
            {job.errorMessage ?? "The job failed during generation."}
          </p>
          <div className="button-row">
            <button
              type="button"
              onClick={retryFailedJob}
              disabled={isRetrying}
              className="button button-primary"
            >
              {isRetrying ? "Retrying..." : "Retry failed job"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );

  return (
    <div className="cinema-shell cinema-noise min-h-[100dvh] overflow-hidden px-4 py-6 text-[#fff1dc] md:px-8 md:py-8">
      <HyperflowAssemblyScaffold leftRail={leftRail} rightRail={rightRail}>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Production File</p>
              <h1>{job?.subjectSymbol ?? "Token"} render status</h1>
            </div>
          </div>
          <p className="route-summary">
            {job?.subjectAddress ?? jobId}
          </p>
          {error ? <p className="inline-error">{error}</p> : null}
        </section>

        {job &&
        payment &&
        (job.status === "awaiting_payment" ||
          job.status === "payment_detected" ||
          job.status === "payment_confirmed") ? (
          <PaymentInstructionsCard
            amountSol={payment.amountSol}
            paymentAddress={payment.paymentAddress}
            receivedSol={payment.receivedSol}
            remainingSol={payment.remainingSol}
            statusText={statusLabel(job.status, job.progress)}
          />
        ) : null}

        {video?.videoUrl ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Now Screening</p>
                <h2>Cinematic video</h2>
              </div>
              <div className="button-row">
                <a
                  href={`/api/video/${jobId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-primary"
                >
                  Download video
                </a>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-secondary"
                >
                  Post to X
                </a>
              </div>
            </div>
            <VideoPlayer
              src={`/api/video/${jobId}`}
              poster={video.thumbnailUrl ?? undefined}
            />
          </section>
        ) : null}

        {report ? <ReportCard report={report} reportUrl={`/api/report/${jobId}`} /> : null}
      </HyperflowAssemblyScaffold>
    </div>
  );
}
