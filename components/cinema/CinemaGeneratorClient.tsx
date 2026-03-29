"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PaymentInstructionsCard } from "@/components/PaymentInstructionsCard";
import { CrossmintHostedPaymentButton } from "@/components/payments/CrossmintHostedPaymentButton";
import { HyperflowAssemblyScaffold } from "@/components/shell/HyperflowAssemblyScaffold";
import {
  CINEMA_PACKAGE_TYPES,
  type CinemaPageConfig,
  getCinemaPackageConfig,
} from "@/lib/cinema/config";
import type {
  JobDocument,
  PackageType,
  RequestedTokenChain,
  VideoStyleId,
} from "@/lib/types/domain";

type Viewer = {
  userId: string;
  email: string | null;
} | null;

interface CreateJobResponse {
  jobId: string;
  priceSol: number;
  paymentAddress: string;
  amountSol: number;
  tokenAddress?: string | null;
  chain?: RequestedTokenChain | null;
  subjectName?: string | null;
  subjectSymbol?: string | null;
  subjectImage?: string | null;
  stylePreset?: VideoStyleId | null;
}

interface JobStatusResponse {
  job?: JobDocument;
  status?: string;
  progress?: string;
  payment?: {
    amountSol: number;
    paymentAddress: string;
    receivedSol?: number;
    remainingSol?: number;
  };
  error?: string;
  message?: string;
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
      return "Auto";
  }
}

function statusLabel(status?: string, progress?: string): string {
  if (status === "awaiting_payment") return "Awaiting payment";
  if (status === "payment_detected") return "Payment detected";
  if (status === "payment_confirmed") return "Payment confirmed";
  if (progress === "generating_report") return "Building story pack";
  if (progress === "generating_video") return "Rendering video";
  if (status === "processing") return "In render pipeline";
  if (status === "complete") return "Ready";
  if (status === "failed") return "Failed";
  return "Staging";
}

function buildCreativeDirection(input: {
  storyNotes: string;
  characterReferences: string;
  visualReferences: string;
  lyrics: string;
  dialogue: string;
  imageReferences: string[];
}): string | undefined {
  const sections = [
    input.storyNotes.trim()
      ? `Story notes: ${input.storyNotes.trim()}`
      : null,
    input.characterReferences.trim()
      ? `Character references: ${input.characterReferences.trim()}`
      : null,
    input.visualReferences.trim()
      ? `Visual references: ${input.visualReferences.trim()}`
      : null,
    input.lyrics.trim() ? `Lyrics or song notes: ${input.lyrics.trim()}` : null,
    input.dialogue.trim() ? `Dialogue direction: ${input.dialogue.trim()}` : null,
    input.imageReferences.filter(Boolean).length
      ? `Image reference URLs: ${input.imageReferences.filter(Boolean).join(", ")}`
      : null,
  ].filter(Boolean);

  return sections.length ? sections.join("\n") : undefined;
}

function crossmintProductLocator(input: {
  pricingMode: "public" | "private";
  packageType: PackageType;
}): string | undefined {
  if (input.pricingMode === "private") {
    return input.packageType === "1d"
      ? process.env.NEXT_PUBLIC_CROSSMINT_PRIVATE_30_PRODUCT
      : process.env.NEXT_PUBLIC_CROSSMINT_PRIVATE_60_PRODUCT;
  }

  return input.packageType === "1d"
    ? process.env.NEXT_PUBLIC_CROSSMINT_PUBLIC_30_PRODUCT
    : process.env.NEXT_PUBLIC_CROSSMINT_PUBLIC_60_PRODUCT;
}

export function CinemaGeneratorClient(input: {
  config: CinemaPageConfig;
  viewer: Viewer;
}) {
  const { config, viewer } = input;
  const [subjectName, setSubjectName] = useState("");
  const [subjectDescription, setSubjectDescription] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [chain, setChain] = useState<RequestedTokenChain>("auto");
  const [packageType, setPackageType] = useState<PackageType>("1d");
  const [stylePreset, setStylePreset] = useState<VideoStyleId>(config.defaultStyle);
  const [audioEnabled, setAudioEnabled] = useState(config.defaultAudioEnabled);
  const [storyNotes, setStoryNotes] = useState("");
  const [characterReferences, setCharacterReferences] = useState("");
  const [visualReferences, setVisualReferences] = useState("");
  const [sourceMediaUrl, setSourceMediaUrl] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [imageReferences, setImageReferences] = useState(["", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobPayment, setJobPayment] = useState<CreateJobResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);

  useEffect(() => {
    setAudioEnabled(config.defaultAudioEnabled);
  }, [config.defaultAudioEnabled]);

  const packageConfig = useMemo(
    () =>
      getCinemaPackageConfig({
        packageType,
        pricingMode: config.pricingMode,
      }),
    [config.pricingMode, packageType],
  );

  async function createJob() {
    setError(null);
    setJobPayment(null);
    const creativeDirection = buildCreativeDirection({
      storyNotes,
      characterReferences,
      visualReferences,
      lyrics,
      dialogue,
      imageReferences,
    });

    if (config.requestKind === "token_video" && !tokenAddress.trim()) {
      setError("Token address is required.");
      return;
    }

    if (config.requestKind !== "token_video" && !subjectName.trim()) {
      setError(`${config.subjectLabel} is required.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const body =
        config.requestKind === "token_video"
          ? {
              requestKind: "token_video" as const,
              tokenAddress: tokenAddress.trim(),
              chain,
              packageType,
              stylePreset,
              subjectDescription: subjectDescription.trim() || undefined,
              requestedPrompt: creativeDirection,
              audioEnabled: config.audioMode === "required" ? true : audioEnabled,
              pricingMode: config.pricingMode,
              visibility: config.visibility,
              experience: config.id,
            }
          : {
              requestKind: config.requestKind,
              subjectName: subjectName.trim(),
              subjectDescription: subjectDescription.trim() || undefined,
              packageType,
              stylePreset,
              requestedPrompt: creativeDirection,
              sourceMediaUrl: sourceMediaUrl.trim() || undefined,
              audioEnabled: config.audioMode === "required" ? true : audioEnabled,
              pricingMode: config.pricingMode,
              visibility: config.visibility,
              experience: config.id,
            };

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!jobPayment?.jobId) return;

    let timer: NodeJS.Timeout | null = null;
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobPayment.jobId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as JobStatusResponse;
        if (!response.ok) {
          throw new Error(payload.message ?? payload.error ?? "Failed to fetch job status.");
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
            <p className="eyebrow">{config.eyebrow}</p>
            <h2>{config.title}</h2>
          </div>
        </div>
        <p className="route-summary">{config.summary}</p>
        <div className="route-badges">
          {config.heroChips.map((chip) => (
            <span key={chip} className="status-badge">
              {chip}
            </span>
          ))}
        </div>
      </section>

      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Package</p>
            <h2>{packageConfig.label}</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Runtime</span>
              <strong>{packageConfig.videoSeconds} seconds</strong>
            </div>
            <p className="route-summary compact">{packageConfig.subtitle}</p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Rate</span>
              <strong>{packageConfig.priceSol} SOL</strong>
            </div>
            <p className="route-summary compact">
              {config.pricingMode === "private"
                ? "Private studio pricing with gated gallery."
                : "Public pricing for lightweight open generation."}
            </p>
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
            <p className="eyebrow">Interface Boxes</p>
            <h2>Optional dropdowns</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Characters</span>
              <strong>Reference identities</strong>
            </div>
            <p className="route-summary compact">
              Give the generator people, archetypes, or roles to preserve on screen.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Stories</span>
              <strong>Direction, pacing, ending</strong>
            </div>
            <p className="route-summary compact">
              Feed the story spine, not just the topic label.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Lyrics</span>
              <strong>Optional audio guide</strong>
            </div>
            <p className="route-summary compact">
              Useful when audio is on. Silent routes simply ignore it.
            </p>
          </article>
        </div>
      </section>

      <section className="panel rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Visibility</p>
            <h2>{config.visibility === "private" ? "Private gallery" : "Public gallery"}</h2>
          </div>
        </div>
        <p className="route-summary compact">
          {config.visibility === "private"
            ? viewer
              ? `Logged in as ${viewer.email ?? viewer.userId}. Completed jobs stay private by default.`
              : "Crossmint login protects the private gallery and private job creation path."
            : "Completed jobs can appear in the shared public gallery unless moderated."}
        </p>
      </section>
    </div>
  );

  const galleryHref = config.visibility === "private" ? "/gallery/private" : "/gallery";
  const paymentLocator = crossmintProductLocator({
    pricingMode: config.pricingMode,
    packageType,
  });

  return (
    <div className="cinema-shell cinema-noise min-h-[100dvh] overflow-hidden px-4 py-6 text-[#fff1dc] md:px-8 md:py-8">
      <HyperflowAssemblyScaffold leftRail={leftRail} rightRail={rightRail}>
        <section className="panel home-hero-panel">
          <div className="home-hero-copy">
            <p className="eyebrow">{config.themeTone}</p>
            <h1>{config.title}</h1>
            <p className="route-summary">{config.summary}</p>
            <div className="route-badges">
              <span className="status-badge">{packageConfig.priceSol} SOL</span>
              <span className="status-badge">{packageConfig.videoSeconds}s</span>
              <span className="status-badge">
                {config.audioMode === "required"
                  ? "voice on"
                  : audioEnabled
                    ? "audio on"
                    : "audio off"}
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Assembly Form</p>
              <h2>Configure the brief</h2>
            </div>
            <div className="button-row">
              <Link className="button button-secondary" href={galleryHref}>
                Open gallery
              </Link>
            </div>
          </div>

          <div className="form-stack">
            {config.requestKind === "token_video" ? (
              <div className="field">
                <span>{config.subjectLabel}</span>
                <input
                  value={tokenAddress}
                  onChange={(event) => setTokenAddress(event.target.value)}
                  placeholder={config.subjectPlaceholder}
                  disabled={isSubmitting}
                />
              </div>
            ) : (
              <div className="field">
                <span>{config.subjectLabel}</span>
                <input
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  placeholder={config.subjectPlaceholder}
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div className="field">
              <span>{config.subjectDescriptionLabel}</span>
              <textarea
                rows={4}
                value={subjectDescription}
                onChange={(event) => setSubjectDescription(event.target.value)}
                placeholder={config.subjectDescriptionPlaceholder}
                disabled={isSubmitting}
              />
            </div>

            {config.supportsChain ? (
              <div className="field">
                <span>Chain</span>
                <select
                  value={chain}
                  onChange={(event) => setChain(event.target.value as RequestedTokenChain)}
                  disabled={isSubmitting}
                >
                  {(["auto", "solana", "ethereum", "bsc", "base"] as const).map((item) => (
                    <option key={item} value={item}>
                      {chainLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="form-row-grid">
              <div className="field">
                <span>Runtime</span>
                <select
                  value={packageType}
                  onChange={(event) => setPackageType(event.target.value as PackageType)}
                  disabled={isSubmitting}
                >
                  {CINEMA_PACKAGE_TYPES.map((item) => {
                    const option = getCinemaPackageConfig({
                      packageType: item,
                      pricingMode: config.pricingMode,
                    });
                    return (
                      <option key={item} value={item}>
                        {option.label} · {option.priceSol} SOL
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="field">
                <span>Style</span>
                <select
                  value={stylePreset}
                  onChange={(event) => setStylePreset(event.target.value as VideoStyleId)}
                  disabled={isSubmitting}
                >
                  {config.styleOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {config.requestKind !== "token_video" ? (
              <div className="field">
                <span>Source link</span>
                <input
                  value={sourceMediaUrl}
                  onChange={(event) => setSourceMediaUrl(event.target.value)}
                  placeholder="YouTube or Spotify link"
                  disabled={isSubmitting}
                />
                <p className="route-summary compact">
                  Paste a source link here and the stack will pull transcript, keep the render audio external, and stitch the sourced track later.
                </p>
              </div>
            ) : null}

            <details className="optional-panel" open={config.requestKind === "bedtime_story"}>
              <summary>Story box</summary>
              <div className="optional-panel-body">
                <div className="field">
                  <span>Story direction</span>
                  <textarea
                    rows={4}
                    value={storyNotes}
                    onChange={(event) => setStoryNotes(event.target.value)}
                    placeholder="Opening beat, middle beat, ending image, or a pasted story block."
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </details>

            <details className="optional-panel">
              <summary>Characters box</summary>
              <div className="optional-panel-body">
                <div className="field">
                  <span>Character references</span>
                  <textarea
                    rows={3}
                    value={characterReferences}
                    onChange={(event) => setCharacterReferences(event.target.value)}
                    placeholder="Roles, personalities, or archetypes to keep consistent."
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </details>

            <details className="optional-panel">
              <summary>Visual box</summary>
              <div className="optional-panel-body">
                <div className="field">
                  <span>Visual references</span>
                  <textarea
                    rows={3}
                    value={visualReferences}
                    onChange={(event) => setVisualReferences(event.target.value)}
                    placeholder="Materials, environments, composition, camera mood."
                    disabled={isSubmitting}
                  />
                </div>
                <div className="form-row-grid">
                  {imageReferences.map((value, index) => (
                    <div key={`image-ref-${index}`} className="field">
                      <span>Image URL {index + 1}</span>
                      <input
                        value={value}
                        onChange={(event) => {
                          const next = [...imageReferences];
                          next[index] = event.target.value;
                          setImageReferences(next);
                        }}
                        placeholder="https://..."
                        disabled={isSubmitting}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </details>

            <details className="optional-panel">
              <summary>Lyrics and dialogue box</summary>
              <div className="optional-panel-body">
                <div className="field">
                  <span>Lyrics</span>
                  <textarea
                    rows={3}
                    value={lyrics}
                    onChange={(event) => setLyrics(event.target.value)}
                    placeholder="Optional song lines or rhythm cues."
                    disabled={isSubmitting}
                  />
                </div>
                <div className="field">
                  <span>Dialogue</span>
                  <textarea
                    rows={3}
                    value={dialogue}
                    onChange={(event) => setDialogue(event.target.value)}
                    placeholder="Optional narration or spoken direction."
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </details>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={config.audioMode === "required" ? true : audioEnabled}
                onChange={(event) => setAudioEnabled(event.target.checked)}
                disabled={isSubmitting || config.audioMode === "required"}
              />
              <span>
                {config.audioMode === "required"
                  ? "Audio is required on this route."
                  : "Optional audio on"}
              </span>
            </label>

            <div className="inline-note">
              Legacy hashmedia and x402 callers keep using the original adapter contract. These
              route nodes only add pricing, visibility, and story-brief layers on top.
            </div>

            <div className="button-row">
              <button
                type="button"
                onClick={createJob}
                disabled={isSubmitting}
                className="button button-primary"
              >
                {isSubmitting ? "Opening payment..." : "Generate cinema"}
              </button>
            </div>

            {error ? <p className="inline-error">{error}</p> : null}
          </div>
        </section>

        {jobPayment ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Payment Adapter</p>
                <h2>{(jobPayment.subjectName ?? subjectName) || "Job"} is queued</h2>
              </div>
              <div className="button-row">
                <Link className="button button-secondary" href={`/job/${jobPayment.jobId}`}>
                  Open job page
                </Link>
              </div>
            </div>
            <div className="button-row">
              <CrossmintHostedPaymentButton
                productLocator={paymentLocator}
                label="Pay with Crossmint"
              />
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
      </HyperflowAssemblyScaffold>
    </div>
  );
}
