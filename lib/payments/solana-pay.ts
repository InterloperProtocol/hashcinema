import { getEnv } from "@/lib/env";

export function solToLamports(solAmount: number): number {
  return Math.round(solAmount * 1_000_000_000);
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

export function getPlatformPaymentWallet(): string {
  return getEnv().HASHCINEMA_PAYMENT_WALLET;
}

export function createSolanaPayUrl(params: {
  amountSol: number;
  memo: string;
  label?: string;
  message?: string;
}): string {
  const wallet = getPlatformPaymentWallet();
  const url = new URL(`solana:${wallet}`);
  url.searchParams.set("amount", params.amountSol.toFixed(9));
  url.searchParams.set("memo", params.memo);
  url.searchParams.set("label", params.label ?? "HASHCINEMA");
  url.searchParams.set(
    "message",
    params.message ?? "Generate Wallet Cinema",
  );
  return url.toString();
}
