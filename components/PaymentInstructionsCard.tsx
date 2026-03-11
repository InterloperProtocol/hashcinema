"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

interface PaymentInstructionsCardProps {
  amountSol: number;
  paymentAddress: string;
  receivedSol?: number;
  remainingSol?: number;
  statusText?: string;
}

function formatSol(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function fallbackCopy(value: string): boolean {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  return copied;
}

export function PaymentInstructionsCard(props: PaymentInstructionsCardProps) {
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const payableSol = props.remainingSol ?? props.amountSol;
  const payableAmount = formatSol(payableSol);
  const qrPayload = useMemo(
    () =>
      `solana:${props.paymentAddress}?amount=${encodeURIComponent(payableAmount)}`,
    [props.paymentAddress, payableAmount],
  );

  const copyPayload = [
    "HASHCINEMA manual payment",
    `Address: ${props.paymentAddress}`,
    `Amount (SOL): ${payableAmount}`,
    "Network: Solana",
    "Send exactly the amount above.",
  ].join("\n");

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    setQrError(null);

    async function buildQrCode() {
      try {
        const QRCode = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(qrPayload, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 256,
        });
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setQrError(
            error instanceof Error ? error.message : "Failed to generate QR code.",
          );
        }
      }
    }

    void buildQrCode();
    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  async function copy(label: string, value: string) {
    let copied = false;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      copied = fallbackCopy(value);
    }

    if (copied) {
      setCopySuccess(`${label} copied.`);
      setCopyError(null);
      return;
    }

    setCopySuccess(null);
    setCopyError("Clipboard copy failed. Please copy manually.");
  }

  return (
    <section className="grid gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:grid-cols-[1fr,280px]">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-100">Payment Instructions</h2>

        <p className="text-sm text-zinc-300">
          Manual send only: copy the address and amount exactly, then send from your wallet app.
        </p>

        <p className="text-sm text-zinc-300">
          Required amount:{" "}
          <span className="font-semibold text-cyan-200">{formatSol(props.amountSol)} SOL</span>
          {typeof props.receivedSol === "number" ? (
            <>
              {" | "}Received:{" "}
              <span className="font-semibold text-zinc-100">{formatSol(props.receivedSol)} SOL</span>
            </>
          ) : null}
          {typeof props.remainingSol === "number" && props.remainingSol > 0 ? (
            <>
              {" | "}Remaining:{" "}
              <span className="font-semibold text-amber-200">{formatSol(props.remainingSol)} SOL</span>
            </>
          ) : null}
        </p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Payment Address</p>
          <p className="mt-1 break-all text-sm text-zinc-100">{props.paymentAddress}</p>
          <button
            type="button"
            onClick={() => void copy("Address", props.paymentAddress)}
            className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Copy address
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Amount (SOL)</p>
          <p className="mt-1 break-all text-sm text-zinc-100">{payableAmount}</p>
          <button
            type="button"
            onClick={() => void copy("Amount", payableAmount)}
            className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Copy amount
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void copy("Payment payload", copyPayload)}
            className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Copy full payment instructions
          </button>
        </div>

        {props.statusText ? (
          <p className="text-sm text-zinc-300">
            Status: <span className="font-semibold text-cyan-200">{props.statusText}</span>
          </p>
        ) : null}

        {copySuccess ? (
          <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {copySuccess}
          </p>
        ) : null}

        {copyError ? (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {copyError}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
        <p className="mb-3 text-xs uppercase tracking-[0.16em] text-zinc-400">QR</p>
        {qrDataUrl ? (
          <div className="space-y-3">
            <Image
              src={qrDataUrl}
              alt="Payment QR code"
              width={224}
              height={224}
              unoptimized
              className="mx-auto h-56 w-56 rounded-md border border-zinc-800 bg-white p-2"
            />
            <p className="text-xs leading-relaxed text-zinc-300">
              Scan in your Solana wallet app and verify both address and amount before
              sending.
            </p>
          </div>
        ) : qrError ? (
          <p className="text-sm leading-relaxed text-red-200">QR unavailable: {qrError}</p>
        ) : (
          <p className="text-sm leading-relaxed text-zinc-300">Generating QR code...</p>
        )}
      </div>
    </section>
  );
}
