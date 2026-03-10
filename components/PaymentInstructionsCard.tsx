"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

interface PaymentInstructionsCardProps {
  amountSol: number;
  paymentWallet: string;
  memo: string;
  solanaPayUrl: string;
  receivedSol?: number;
  remainingSol?: number;
  statusText?: string;
}

function formatSol(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, "");
}

export function PaymentInstructionsCard(props: PaymentInstructionsCardProps) {
  const [copyError, setCopyError] = useState<string | null>(null);

  const qrUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
      props.solanaPayUrl,
    )}`;
  }, [props.solanaPayUrl]);

  const copyPayload = [
    `Wallet: ${props.paymentWallet}`,
    `Amount (SOL): ${formatSol(props.remainingSol ?? props.amountSol)}`,
    `Memo: ${props.memo}`,
    `Solana Pay: ${props.solanaPayUrl}`,
  ].join("\n");

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(null);
    } catch {
      setCopyError("Clipboard copy failed.");
    }
  }

  return (
    <section className="grid gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:grid-cols-[1fr,280px]">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-100">Payment Instructions</h2>

        <p className="text-sm text-zinc-300">
          Manual send fallback: paste the wallet + amount below, include memo exactly, then send.
        </p>

        <p className="text-sm text-zinc-300">
          Required amount:{" "}
          <span className="font-semibold text-cyan-200">{formatSol(props.amountSol)} SOL</span>
          {typeof props.receivedSol === "number" ? (
            <>
              {" · "}Received:{" "}
              <span className="font-semibold text-zinc-100">{formatSol(props.receivedSol)} SOL</span>
            </>
          ) : null}
          {typeof props.remainingSol === "number" && props.remainingSol > 0 ? (
            <>
              {" · "}Remaining:{" "}
              <span className="font-semibold text-amber-200">{formatSol(props.remainingSol)} SOL</span>
            </>
          ) : null}
        </p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Wallet</p>
          <p className="mt-1 break-all text-sm text-zinc-100">{props.paymentWallet}</p>
          <button
            type="button"
            onClick={() => copy(props.paymentWallet)}
            className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Copy wallet
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Amount (SOL)</p>
          <p className="mt-1 break-all text-sm text-zinc-100">
            {formatSol(props.remainingSol ?? props.amountSol)}
          </p>
          <button
            type="button"
            onClick={() => copy(formatSol(props.remainingSol ?? props.amountSol))}
            className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Copy amount
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Memo</p>
          <p className="mt-1 break-all text-sm text-zinc-100">{props.memo}</p>
          <button
            type="button"
            onClick={() => copy(props.memo)}
            className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Copy memo
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={props.solanaPayUrl}
            className="inline-flex rounded-lg border border-cyan-500 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10"
          >
            Open Solana Pay Link
          </a>
          <button
            type="button"
            onClick={() => copy(copyPayload)}
            className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Copy full payment payload
          </button>
        </div>

        {props.statusText ? (
          <p className="text-sm text-zinc-300">
            Status: <span className="font-semibold text-cyan-200">{props.statusText}</span>
          </p>
        ) : null}

        {copyError ? (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {copyError}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
        <p className="mb-3 text-xs uppercase tracking-[0.16em] text-zinc-400">Scan to Pay</p>
        <Image
          src={qrUrl}
          alt="Solana Pay QR"
          width={260}
          height={260}
          className="h-[260px] w-[260px] rounded-lg bg-white p-2"
        />
      </div>
    </section>
  );
}
