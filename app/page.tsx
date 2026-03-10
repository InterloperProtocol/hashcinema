"use client";

import { PackageSelector } from "@/components/PackageSelector";
import { PaymentInstructionsCard } from "@/components/PaymentInstructionsCard";
import { WalletInput } from "@/components/WalletInput";
import type { PaymentInstructions } from "@/lib/payments/instructions";
import { JobDocument, PackageType } from "@/lib/types/domain";
import Link from "next/link";
import { useEffect, useState } from "react";

interface CreateJobResponse {
  jobId: string;
  priceSol: number;
  paymentWallet: string;
  memo: string;
  solanaPayUrl: string;
}

interface JobStatusResponse {
  job?: JobDocument;
  payment?: PaymentInstructions;
  status?: string;
  progress?: string;
  error?: string;
}

function statusLabel(status: string | undefined, progress: string | undefined): string {
  if (status === "awaiting_payment") return "Awaiting payment";
  if (status === "payment_detected") return "Payment detected";
  if (status === "payment_confirmed") return "Payment confirmed";
  if (progress === "generating_report") return "Generating report";
  if (progress === "generating_video") return "Generating video";
  if (status === "processing") return "Processing";
  if (status === "complete") return "Complete";
  if (status === "failed") return "Failed";
  return "Pending";
}

export default function HomePage() {
  const [wallet, setWallet] = useState("");
  const [packageType, setPackageType] = useState<PackageType>("1d");
  const [jobPayment, setJobPayment] = useState<CreateJobResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createJob() {
    setError(null);
    if (!wallet) {
      setError("Wallet address is required.");
      return;
    }

    setIsSubmitting(true);
    setJobPayment(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, packageType }),
      });

      const payload = (await response.json()) as CreateJobResponse & {
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.jobId) {
        throw new Error(payload.message ?? payload.error ?? "Failed to create job.");
      }

      setJobPayment(payload);
      setJobStatus({ status: "awaiting_payment", progress: "awaiting_payment" });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unexpected error",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!jobPayment?.jobId) {
      return;
    }

    let timer: NodeJS.Timeout | null = null;
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobPayment.jobId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as JobStatusResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to fetch job status.");
        }

        if (!cancelled) {
          setJobStatus(payload);
        }

        const status = payload.job?.status ?? payload.status;
        if (status === "processing" || status === "complete") {
          if (timer) clearInterval(timer);
          window.location.href = `/job/${jobPayment.jobId}`;
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Polling failed.");
        }
      }
    };

    void poll();
    timer = setInterval(() => void poll(), 6000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [jobPayment?.jobId]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080d]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(48,219,255,0.2),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(245,96,64,0.15),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(140,115,255,0.12),transparent_45%)]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-10 md:px-8">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/90">
            HASHCINEMA
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-zinc-100 md:text-5xl">
            Pay Once, Memo the Job, Generate the Cinema
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-300">
            Create a job, send SOL to the platform wallet with memo = jobId, and
            Helius will auto-detect and start generation.
          </p>
        </header>

        <section className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur md:p-8">
          <WalletInput value={wallet} onChange={setWallet} disabled={isSubmitting} />
          <PackageSelector
            value={packageType}
            onChange={setPackageType}
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={createJob}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating Job..." : "Create Job"}
          </button>
          {error ? (
            <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
        </section>

        {jobPayment ? (
          <div className="mt-6 space-y-4">
            <PaymentInstructionsCard
              amountSol={jobStatus?.payment?.amountSol ?? jobPayment.priceSol}
              paymentWallet={jobStatus?.payment?.paymentWallet ?? jobPayment.paymentWallet}
              memo={jobStatus?.payment?.memo ?? jobPayment.memo}
              solanaPayUrl={jobStatus?.payment?.solanaPayUrl ?? jobPayment.solanaPayUrl}
              receivedSol={jobStatus?.payment?.receivedSol}
              remainingSol={jobStatus?.payment?.remainingSol}
              statusText={statusLabel(
                jobStatus?.job?.status ?? jobStatus?.status,
                jobStatus?.job?.progress ?? jobStatus?.progress,
              )}
            />
            <Link
              href={`/job/${jobPayment.jobId}`}
              className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Open Job Page
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}
