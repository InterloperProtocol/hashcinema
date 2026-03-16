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
  paymentAddress: string;
  amountSol: number;
}

interface JobStatusResponse {
  job?: JobDocument;
  payment?: PaymentInstructions;
  status?: string;
  progress?: string;
  error?: string;
  message?: string;
}

const trailerCards = [
  {
    eyebrow: "Wallet Personality",
    title: "Hero, menace, martyr, or timeline goblin",
    body:
      "We read your Pump.fun trading behavior, score the emotional profile, and decide whether your session was strategy, self-expression, or a late-night incident.",
  },
  {
    eyebrow: "Trench Lore",
    title: "The moment the group chat would never let die",
    body:
      "Every run gets its Lore, its Main Character Moment, and the weird sequence that deserves permanent folklore status.",
  },
  {
    eyebrow: "Final Cut",
    title: "A short film from pure on-chain chaos",
    body:
      "Cinematic AI video, combined report, direct wallet link, and a job page that updates automatically once payment lands.",
  },
];

const pipelineCards = [
  {
    step: "Scene One",
    title: "Paste the wallet",
    body:
      "No wallet connect. No browser extension handshake. Just the address and the time range.",
  },
  {
    step: "Scene Two",
    title: "We analyze the trenches",
    body:
      "Pump activity gets filtered, normalized, scored, and turned into personality reads, lore moments, and story beats.",
  },
  {
    step: "Scene Three",
    title: "You get the trailer",
    body:
      "Video, report, and a replayable record of whatever exactly happened during that session.",
  },
];

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M18.244 2H21.5l-7.11 8.128L22.75 22h-6.546l-5.126-6.708L5.21 22H1.95l7.606-8.694L1.5 2h6.712l4.633 6.12L18.244 2Zm-1.14 18.05h1.804L7.228 3.845H5.292L17.104 20.05Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M21.408 4.593a1.64 1.64 0 0 0-1.692-.208L3.127 11.23a1.19 1.19 0 0 0 .08 2.225l4.21 1.38 1.63 5.102a1.19 1.19 0 0 0 2.046.39l2.35-2.642 4.61 3.396a1.64 1.64 0 0 0 2.575-.95l2.215-13.913a1.64 1.64 0 0 0-.435-1.625ZM9.9 14.195l8.22-6.81-6.84 7.62a.6.6 0 0 0-.147.292l-.708 2.995-.525-3.033Z" />
    </svg>
  );
}

function statusLabel(status: string | undefined, progress: string | undefined): string {
  if (status === "awaiting_payment") return "Waiting on the send";
  if (status === "payment_detected") return "Payment seen on-chain";
  if (status === "payment_confirmed") return "Payment locked";
  if (progress === "generating_report") return "Writing the dossier";
  if (progress === "generating_video") return "Cutting the trailer";
  if (status === "processing") return "In the edit suite";
  if (status === "complete") return "Premiere ready";
  if (status === "failed") return "Production halted";
  return "Staging";
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
          throw new Error(
            payload.message ?? payload.error ?? "Failed to fetch job status.",
          );
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
    <div className="cinema-shell cinema-noise min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top,rgba(255,116,71,0.18),transparent_48%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[32rem] bg-[radial-gradient(circle_at_center,rgba(135,219,255,0.12),transparent_58%)]" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-6 md:px-8 md:py-8">
        <section className="cinema-grid cinema-panel rounded-[2rem] px-6 py-8 md:px-10 md:py-12">
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-center">
            <div>
              <p className="cinema-kicker text-[0.72rem] font-semibold">Trench Cinema</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-[0.94] tracking-[-0.04em] text-[#fff3de] sm:text-6xl md:text-7xl">
                Your memecoin trading history?
                <br />
                Absolute Cinema.
              </h1>

              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#f0dcc1] md:text-xl">
                Pumps. Rugs. Revenge buys at 3AM. Its all part of your lore.
              </p>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--muted)] md:text-lg">
                Paste a wallet and we turn the last 24 to 72 hours of Pump.fun trading
                into a cinematic AI video based on wallet personality analysis.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#ffe6bf]">
                  Keep Clicking! Your losses are our data points.
                </span>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[26rem] lg:ml-auto lg:mr-0">
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),rgba(255,255,255,0.03)_45%,rgba(0,0,0,0.18)_100%)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_62%)]" />
                <div className="relative aspect-square overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5">
                  <img
                    src="/logo.gif"
                    alt="Trench Cinema logo"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cinema-panel rounded-[2rem] p-5 md:p-6">
          <div className="rounded-[1.6rem] border border-white/10 bg-black/25 p-5 md:p-6">
            <div className="max-w-3xl">
              <p className="cinema-kicker text-[0.68rem] font-semibold">Start The Cut</p>
              <h2 className="font-display mt-3 text-4xl leading-none text-[#fff1db]">
                Turn your trades into a trailer
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                Pick the window, drop in the wallet, and let the engine turn the
                on-chain mess into something watchable.
              </p>
            </div>

            <div className="mt-6 space-y-5">
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
                className="cinema-primary-button inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Opening the production file..." : "Generate Trench Cinema"}
              </button>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="cinema-panel-soft rounded-[1.5rem] p-4">
                  <p className="cinema-kicker text-[0.65rem] font-semibold">Window</p>
                  <p className="mt-3 font-display text-3xl text-[#fff1dc]">24-72h</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    Focused on the latest stretch of Pump.fun behavior rather than a full
                    wallet biography.
                  </p>
                </div>
                <div className="cinema-panel-soft rounded-[1.5rem] p-4">
                  <p className="cinema-kicker text-[0.65rem] font-semibold">Readout</p>
                  <p className="mt-3 font-display text-3xl text-[#fff1dc]">Lore</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    Main character trades, most unwell turns, and the line your group chat
                    would keep quoting.
                  </p>
                </div>
                <div className="cinema-panel-soft rounded-[1.5rem] p-4">
                  <p className="cinema-kicker text-[0.65rem] font-semibold">Output</p>
                  <p className="mt-3 font-display text-3xl text-[#fff1dc]">Video + PDF</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    A playable AI trailer and a combined report you can open, download, and
                    share.
                  </p>
                </div>
              </div>

              {error ? (
                <p className="rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {jobPayment ? (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="cinema-kicker text-[0.68rem] font-semibold">Production Started</p>
                <h2 className="font-display mt-2 text-3xl text-[#fff1db]">Lock in the payment.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                  Send the exact amount to the dedicated address below. Once the chain confirms
                  it, the job page takes over automatically.
                </p>
              </div>
              <Link
                href={`/job/${jobPayment.jobId}`}
                className="cinema-secondary-button inline-flex rounded-2xl px-4 py-3 text-sm font-medium transition"
              >
                Open job page
              </Link>
            </div>

            <PaymentInstructionsCard
              amountSol={jobStatus?.payment?.amountSol ?? jobPayment.amountSol}
              paymentAddress={jobStatus?.payment?.paymentAddress ?? jobPayment.paymentAddress}
              receivedSol={jobStatus?.payment?.receivedSol}
              remainingSol={jobStatus?.payment?.remainingSol}
              statusText={statusLabel(
                jobStatus?.job?.status ?? jobStatus?.status,
                jobStatus?.job?.progress ?? jobStatus?.progress,
              )}
            />
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          {trailerCards.map((card) => (
            <article key={card.title} className="cinema-panel-soft rounded-[1.7rem] p-5">
              <p className="cinema-kicker text-[0.65rem] font-semibold">{card.eyebrow}</p>
              <h3 className="font-display mt-3 text-2xl leading-tight text-[#fff0d8]">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{card.body}</p>
            </article>
          ))}
        </section>

        <section className="cinema-panel rounded-[2rem] p-6 md:p-8">
          <div className="max-w-3xl">
            <p className="cinema-kicker text-[0.68rem] font-semibold">How it Works?</p>
            <h2 className="font-display mt-3 text-4xl leading-none text-[#fff1dc]">
              Not analytics.
              <br />
              Cinema with receipts.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
              The product flow is simple even if the output feels theatrical. Wallet in.
              Payment confirmed. Video and report out.
            </p>
          </div>

          <div className="cinema-rule my-8" />

          <div className="grid gap-4 md:grid-cols-3">
            {pipelineCards.map((card) => (
              <article key={card.title} className="cinema-panel-soft rounded-[1.5rem] p-5">
                <p className="cinema-kicker text-[0.64rem] font-semibold">{card.step}</p>
                <h3 className="font-display mt-3 text-2xl text-[#fff0da]">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="cinema-panel rounded-[2rem] p-6 md:p-8">
            <p className="cinema-kicker text-[0.68rem] font-semibold">What it is today?</p>
            <h2 className="font-display mt-3 text-4xl leading-none text-[#fff0da]">
              A short film about your trading behavior.
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-[var(--muted)]">
              <p>
                Trench Cinema analyzes your recent memecoin trades and turns them into a
                short film about your trading behavior.
              </p>
              <p>Sometimes heroic.</p>
              <p>Sometimes tragic.</p>
              <p>Always entertaining.</p>
            </div>
          </article>

          <article className="cinema-panel rounded-[2rem] p-6 md:p-8">
            <p className="cinema-kicker text-[0.68rem] font-semibold">The Vision</p>
            <h2 className="font-display mt-3 text-4xl leading-none text-[#fff0da]">
              Trench Cinema will become a platform.
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-[var(--muted)]">
              <p>Trench Cinema is not just a tool.</p>
              <p>It belongs to the trenches as a platform.</p>
              <p>Developers can publish wallet analytics modules.</p>
              <p>Artists can sell cinematic AI video styles.</p>
              <p>Traders can share their edge.</p>
              <p>Anyone can potentially build and sell tools on the platform.</p>
              <p className="text-[#ffe1b1]">HashArt will take a 10% platform fee.</p>
              <p>Just a businessman doing business.</p>
              <p>Memecoin trading is chaos.</p>
              <p className="text-[#fff0d5]">We just turn it into cinema.</p>
            </div>
          </article>
        </section>

        <footer className="cinema-panel-soft flex flex-col gap-4 rounded-[1.8rem] px-5 py-5 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <p>Memecoin trading is chaos. We just turn it into cinema.</p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://x.com/TrenchCinema"
              target="_blank"
              rel="noreferrer"
              className="cinema-secondary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition"
            >
              <XIcon />
              <span>@TrenchCinema</span>
            </a>
            <a
              href="https://t.me/hashartfun"
              target="_blank"
              rel="noreferrer"
              className="cinema-secondary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition"
            >
              <TelegramIcon />
              <span>t.me/hashartfun</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
