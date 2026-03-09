import { getPlatformPaymentWallet, solToLamports } from "@/lib/payments/solana-pay";

export interface HeliusWebhookNativeTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number;
}

export interface HeliusWebhookInstruction {
  programId?: string;
  programName?: string;
  parsed?: unknown;
}

export interface HeliusEnhancedWebhookTransaction {
  signature?: string;
  slot?: number;
  transactionError?: unknown;
  description?: string;
  nativeTransfers?: HeliusWebhookNativeTransfer[];
  instructions?: HeliusWebhookInstruction[];
  events?: Record<string, unknown>;
}

function normalizeMemo(raw: string): string {
  return raw.trim().replace(/^memo:\s*/i, "").trim();
}

function extractMemoFromInstruction(instruction: HeliusWebhookInstruction): string | null {
  const parsed = instruction.parsed;
  if (typeof parsed === "string" && parsed.trim()) {
    return normalizeMemo(parsed);
  }

  if (parsed && typeof parsed === "object") {
    const map = parsed as Record<string, unknown>;
    if (typeof map.memo === "string") {
      return normalizeMemo(map.memo);
    }
    if (map.info && typeof map.info === "object") {
      const info = map.info as Record<string, unknown>;
      if (typeof info.memo === "string") {
        return normalizeMemo(info.memo);
      }
    }
  }

  return null;
}

export function extractMemo(tx: HeliusEnhancedWebhookTransaction): string | null {
  for (const instruction of tx.instructions ?? []) {
    const looksLikeMemoProgram =
      instruction.programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" ||
      instruction.programName?.toUpperCase().includes("MEMO") ||
      false;

    if (looksLikeMemoProgram) {
      const memo = extractMemoFromInstruction(instruction);
      if (memo) {
        return memo;
      }
    }

    const fallbackMemo = extractMemoFromInstruction(instruction);
    if (fallbackMemo) {
      return fallbackMemo;
    }
  }

  const eventMemo = tx.events?.memo;
  if (typeof eventMemo === "string" && eventMemo.trim()) {
    return normalizeMemo(eventMemo);
  }

  const match = tx.description?.match(/memo[:\s]+([a-zA-Z0-9-]{6,})/i);
  if (match?.[1]) {
    return normalizeMemo(match[1]);
  }

  return null;
}

export function totalLamportsToPlatformWallet(
  tx: HeliusEnhancedWebhookTransaction,
): number {
  const platformWallet = getPlatformPaymentWallet();
  return (tx.nativeTransfers ?? [])
    .filter((transfer) => transfer.toUserAccount === platformWallet)
    .reduce((sum, transfer) => sum + (transfer.amount ?? 0), 0);
}

export function hasSufficientPayment(params: {
  tx: HeliusEnhancedWebhookTransaction;
  requiredPriceSol: number;
}): boolean {
  const receivedLamports = totalLamportsToPlatformWallet(params.tx);
  return receivedLamports >= solToLamports(params.requiredPriceSol);
}

export function transactionTargetsPlatformWallet(
  tx: HeliusEnhancedWebhookTransaction,
): boolean {
  const platformWallet = getPlatformPaymentWallet();
  return (tx.nativeTransfers ?? []).some(
    (transfer) => transfer.toUserAccount === platformWallet,
  );
}
