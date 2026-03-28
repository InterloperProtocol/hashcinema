"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdapterBoxCard } from "@/components/AdapterBoxCard";
import { ChainSelector } from "@/components/ChainSelector";
import { PackageSelector } from "@/components/PackageSelector";
import { PaymentInstructionsCard } from "@/components/PaymentInstructionsCard";
import { StylePresetSelector } from "@/components/StylePresetSelector";
import { WalletInput } from "@/components/WalletInput";
import { HyperflowAssemblyScaffold } from "@/components/shell/HyperflowAssemblyScaffold";
import { PACKAGE_CONFIG } from "@/lib/constants";
import { getTokenVideoStylePreset, listSuggestedStyleIds } from "@/lib/memecoins/styles";
import type { PaymentInstructions } from "@/lib/payments/instructions";
import { publicHashCinemaServiceManifest } from "@/lib/service/public-manifest";
import {
  JobDocument,
  PackageType,
  RequestedTokenChain,
  VideoStyleId,
} from "@/lib/types/domain";

interface CreateJobResponse {
  jobId: string;
  priceSol: number;
  paymentAddress: string;
  amountSol: number;
  tokenAddress: string;
  chain: RequestedTokenChain;
  subjectName?: string | null;
  subjectSymbol?: string | null;
  subjectImage?: string | null;
  stylePreset?: VideoStyleId | null;
}

interface JobStatusResponse {
  job?: JobDocument;
  payment?: PaymentInstructions;
  status?: string;
  progress?: string;
  error?: string;
  message?: string;
}

const featureCards = [
  {
    eyebrow: "One Token",
    title: "Single-asset storytelling",
    body:
      "HashCinema is no longer a wallet recap product. One mint or contract goes in, one memecoin video comes out.",
  },
  {
    eyebrow: "Multichain",
    title: "Pump, ETH, BNB, Base",
    body:
      "Pump metadata on Solana, DexScreener-backed token discovery on Ethereum, BNB Chain, and Base, all inside the same flow.",
  },
  {
    eyebrow: "Adapter Box",
    title: "UI or x402 service",
    body:
      "Run it as a low-friction web interface, or call the same packages through `/api/x402/video` for agent-native USDC checkout.",
  },
];

function statusLabel(status: string | undefined, progress: string | undefined): string {
  if (status === "awaiting_payment") return "Waiting on the send";
  if (status === "payment_detected") return "Payment seen on-chain";
  if (status === "payment_confirmed") return "Payment locked";
  if (progress === "generating_report") return "Composing the token card";
  if (progress === "generating_video") return "Rendering the memecoin cut";
  if (status === "processing") return "In the studio";
  if (status === "complete") return "Premiere ready";
  if (status === "failed") return "Render failed";
  return "Staging";
}

function chainLabel(chain: RequestedTokenChain): string {
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
      return "Auto detect";
  }
}

export default function HomePage() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [chain, setChain] = useState<RequestedTokenChain>("auto");
  const [packageType, setPackageType] = useState<PackageType>("1d");
  const [stylePreset, setStylePreset] = useState<VideoStyleId>("hyperflow_assembly");
  const [requestedPrompt, setRequestedPrompt] = useState("");
  const [jobPayment, setJobPayment] = useState<CreateJobResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePackage = PACKAGE_CONFIG[packageType];
  const activeStyle = getTokenVideoStylePreset(stylePreset);
  const suggestedStyles = useMemo(
    () =>
      listSuggestedStyleIds({
        chain: chain === "auto" ? null : chain,
        isPump: chain === "solana",
        description: requestedPrompt,
      }),
    [chain, requestedPrompt],
  );

  async function createJob() {
    setError(null);
    if (!tokenAddress.trim()) {
      setError("Token mint or contract address is required.");
      return;
    }

    setIsSubmitting(true);
    setJobPayment(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: tokenAddress.trim(),
          chain,
          packageType,
          stylePreset,
          requestedPrompt: requestedPrompt.trim() || undefined,
        }),
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

  const leftRail = (
    <div className="rail-stack">
      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">HashCinema</p>
            <h2>Hyperflow Assembly</h2>
          </div>
        </div>
        <p className="route-summary">
          Multichain memecoin video generation shaped like an adapter box: one token input,
          low-friction checkout, and the same service surface available to agents over x402.
        </p>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Mode</span>
              <strong>Token-first video only</strong>
            </div>
            <p className="route-summary compact">
              No wallet trading dossier flow on the homepage anymore. The token is the hero.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Current runtime</span>
              <strong>
                {activePackage.label} / {activePackage.priceSol} SOL
              </strong>
            </div>
            <p className="route-summary compact">{activePackage.subtitle}</p>
          </article>
        </div>
      </section>

      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Selected Cut</p>
            <h2>{activeStyle.label}</h2>
          </div>
        </div>
        <p className="route-summary">{activeStyle.summary}</p>
        <div className="rail-grid">
          <article className="rail-card">
            <p className="eyebrow">Chain</p>
            <strong>{chainLabel(chain)}</strong>
            <span>Auto detect stays on by default and can fall back to manual selection.</span>
          </article>
          <article className="rail-card">
            <p className="eyebrow">Director note</p>
            <strong>{activeStyle.directorNote}</strong>
            <span>{activeStyle.promptSeed}</span>
          </article>
        </div>
      </section>
    </div>
  );

  const rightRail = (
    <div className="rail-stack">
      <AdapterBoxCard service={publicHashCinemaServiceManifest} />

      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Suggested Styles</p>
            <h2>Best fits for this chain</h2>
          </div>
        </div>
        <div className="mini-list">
          {suggestedStyles.map((styleId) => {
            const preset = getTokenVideoStylePreset(styleId);
            return (
              <article key={preset.id} className="mini-item-card">
                <div>
                  <span>{preset.shortLabel}</span>
                  <strong>{preset.label}</strong>
                </div>
                <p className="route-summary compact">{preset.summary}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Submission Rules</p>
            <h2>Keep it simple</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Input</span>
              <strong>One mint or contract address</strong>
            </div>
            <p className="route-summary compact">
              Optional description and style hint are enough to steer the whole render.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Output</span>
              <strong>Video + token card</strong>
            </div>
            <p className="route-summary compact">
              No broad wallet report. The report section becomes a single-token trading card.
            </p>
          </article>
        </div>
      </section>
    </div>
  );

  return (
    <div className="cinema-shell cinema-noise min-h-[100dvh] overflow-hidden px-4 py-6 text-[#fff1dc] md:px-8 md:py-8">
      <HyperflowAssemblyScaffold leftRail={leftRail} rightRail={rightRail}>
        <section className="panel home-hero-panel">
          <div className="home-hero-copy">
            <p className="eyebrow">Multichain Memecoin Video Generator</p>
            <h1>One memecoin in. One cinematic trading card out.</h1>
            <p className="route-summary">
              Paste a Solana mint, ETH contract, BNB memecoin, or Base token address and
              HashCinema builds a short video for that one asset only. No trading report
              dump. No wallet biography. Just a memecoin-specific cut with low-ticket checkout.
            </p>
            <div className="route-badges">
              <span className="status-badge">0.01 SOL / 30 sec</span>
              <span className="status-badge">0.02 SOL / 60 sec</span>
              <span className="status-badge">x402 ready</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Create Job</p>
              <h2>Assemble the token brief</h2>
            </div>
            <div className="button-row">
              <Link className="button button-secondary" href="/gallery">
                Open gallery
              </Link>
            </div>
          </div>

          <div className="form-stack">
            <WalletInput
              value={tokenAddress}
              onChange={setTokenAddress}
              disabled={isSubmitting}
            />

            <ChainSelector value={chain} onChange={setChain} disabled={isSubmitting} />

            <PackageSelector
              value={packageType}
              onChange={setPackageType}
              disabled={isSubmitting}
            />

            <StylePresetSelector
              value={stylePreset}
              onChange={setStylePreset}
              suggested={suggestedStyles}
              disabled={isSubmitting}
            />

            <div className="field">
              <span>Optional direction</span>
              <textarea
                value={requestedPrompt}
                onChange={(event) => setRequestedPrompt(event.target.value)}
                disabled={isSubmitting}
                placeholder="Example: make it feel like a premium token trailer with seafoam control-room UI and a bold ending card."
                maxLength={240}
                rows={4}
              />
            </div>

            <div className="inline-note">
              x402 agents can call <code>/api/x402/video</code> with the same token
              address, style, and runtime options for USDC checkout on Solana.
            </div>

            <div className="button-row">
              <button
                type="button"
                onClick={createJob}
                disabled={isSubmitting}
                className="button button-primary"
              >
                {isSubmitting ? "Opening the render..." : "Generate token video"}
              </button>
              <Link className="button button-secondary" href="/api/service">
                View service manifest
              </Link>
            </div>

            {error ? (
              <p className="inline-error">{error}</p>
            ) : null}
          </div>
        </section>

        {jobPayment ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Job Card</p>
                <h2>
                  {jobPayment.subjectName ?? jobPayment.subjectSymbol ?? "Token"} is queued
                </h2>
              </div>
              <div className="button-row">
                <Link className="button button-secondary" href={`/job/${jobPayment.jobId}`}>
                  Open job page
                </Link>
              </div>
            </div>

            <div className="mini-list">
              <article className="mini-item-card">
                <div>
                  <span>Token</span>
                  <strong>{jobPayment.subjectSymbol ?? tokenAddress}</strong>
                </div>
                <p className="route-summary compact">{jobPayment.tokenAddress}</p>
              </article>
              <article className="mini-item-card">
                <div>
                  <span>Chain</span>
                  <strong>{chainLabel(jobPayment.chain)}</strong>
                </div>
                <p className="route-summary compact">{activeStyle.label}</p>
              </article>
              <article className="mini-item-card">
                <div>
                  <span>Status</span>
                  <strong>
                    {statusLabel(
                      jobStatus?.job?.status ?? jobStatus?.status,
                      jobStatus?.job?.progress ?? jobStatus?.progress,
                    )}
                  </strong>
                </div>
                <p className="route-summary compact">
                  Keep the payment exact so the render can start immediately.
                </p>
              </article>
            </div>

            <div className="stack-section">
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
            </div>
          </section>
        ) : null}

        <section className="module-grid-3x2">
          {featureCards.map((card) => (
            <article key={card.title} className="surface-card module-tile">
              <p className="eyebrow">{card.eyebrow}</p>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          ))}
        </section>
      </HyperflowAssemblyScaffold>
    </div>
  );
}
