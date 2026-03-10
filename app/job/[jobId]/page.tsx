"use client";

import { PaymentInstructionsCard } from "@/components/PaymentInstructionsCard";
import { ReportCard } from "@/components/ReportCard";
import { VideoPlayer } from "@/components/VideoPlayer";
import { FINAL_JOB_STATUSES } from "@/lib/constants";
import type { PaymentInstructions } from "@/lib/payments/instructions";
import { JobDocument, ReportDocument, VideoDocument } from "@/lib/types/domain";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface JobApiPayload {
  job?: JobDocument;
  report?: ReportDocument | null;
  video?: VideoDocument | null;
  payment?: PaymentInstructions;
  error?: string;
}

function statusLabel(status: JobDocument["status"], progress: JobDocument["progress"]) {
  if (status === "awaiting_payment") return "Awaiting payment";
  if (status === "payment_detected") return "Payment detected";
  if (status === "payment_confirmed") return "Payment confirmed";
  if (progress === "generating_report") return "Generating report";
  if (progress === "generating_video") return "Generating video";
  if (status === "processing") return "Processing";
  if (status === "complete") return "Complete";
  return "Failed";
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

export default function JobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [job, setJob] = useState<JobDocument | null>(null);
  const [report, setReport] = useState<ReportDocument | null>(null);
  const [video, setVideo] = useState<VideoDocument | null>(null);
  const [payment, setPayment] = useState<PaymentInstructions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadJob = useCallback(async (): Promise<JobDocument | null> => {
    const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    const payload = (await response.json()) as JobApiPayload;
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to fetch job.");
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

  const isComplete = job?.status === "complete";
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const publicUrl = `${window.location.origin}/job/${jobId}`;
    const text = "My Pump memecoin recap from HASHCINEMA";
    return `https://x.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(publicUrl)}`;
  }, [jobId]);

  return (
    <div className="min-h-screen bg-[#090a10] px-4 py-8 text-zinc-100">
      <main className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            HASHCINEMA JOB
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Job {jobId}</h1>
          {job ? (
            <div className="mt-4 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
              <p>Status: {statusLabel(job.status, job.progress)}</p>
              <p>Package: {job.packageType}</p>
              <p>Price: {job.priceSol} SOL</p>
              <p>Wallet: {job.wallet}</p>
              <p>Progress: {job.progress}</p>
              <p>Tx: {job.txSignature ?? "Not detected yet"}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">Loading job...</p>
          )}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {!isComplete && !error ? (
            <p className="mt-4 text-sm text-zinc-400">
              Pipeline updates automatically. Keep this page open.
            </p>
          ) : null}

          {job?.status === "failed" ? (
            <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {job.errorMessage ?? "The job failed during generation."}
            </p>
          ) : null}
        </div>

        {job &&
        payment &&
        (job.status === "awaiting_payment" ||
          job.status === "payment_detected" ||
          job.status === "payment_confirmed") ? (
          <PaymentInstructionsCard
            amountSol={payment.amountSol}
            paymentWallet={payment.paymentWallet}
            memo={payment.memo}
            solanaPayUrl={payment.solanaPayUrl}
            receivedSol={payment.receivedSol}
            remainingSol={payment.remainingSol}
            statusText={statusLabel(job.status, job.progress)}
          />
        ) : null}

        {isComplete && video?.videoUrl ? (
          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-lg font-semibold">Cinematic Video</h2>
            <VideoPlayer
              src={`/api/video/${jobId}`}
              poster={video.thumbnailUrl ?? undefined}
            />
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/video/${jobId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-cyan-500 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/10"
              >
                Download Video
              </a>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Post to X
              </a>
            </div>
          </section>
        ) : null}

        {isComplete && report ? (
          <ReportCard report={report} reportUrl={`/api/report/${jobId}`} />
        ) : null}

        <Link
          href="/"
          className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Create Another Job
        </Link>
      </main>
    </div>
  );
}
