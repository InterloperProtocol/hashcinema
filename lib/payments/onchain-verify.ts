import { withSolanaRpcFallback } from "@/lib/helius/connection";
import { getPlatformPaymentWallet } from "@/lib/payments/solana-pay";
import {
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
} from "@solana/web3.js";

type ParsedInstructionLike = ParsedInstruction | PartiallyDecodedInstruction;

function isParsedInstruction(
  instruction: ParsedInstructionLike,
): instruction is ParsedInstruction {
  return "parsed" in instruction;
}

function maybeMemoFromInstruction(instruction: ParsedInstructionLike): string | null {
  if (!isParsedInstruction(instruction)) {
    return null;
  }

  const programId = instruction.programId.toBase58();
  const isMemoProgram =
    instruction.program === "spl-memo" ||
    instruction.program === "memo" ||
    programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

  if (!isMemoProgram) {
    return null;
  }

  if (typeof instruction.parsed === "string") {
    return instruction.parsed.trim() || null;
  }

  if (instruction.parsed && typeof instruction.parsed === "object") {
    const parsed = instruction.parsed as Record<string, unknown>;
    if (typeof parsed.memo === "string") {
      return parsed.memo.trim() || null;
    }
  }

  return null;
}

function lamportsToWalletFromInstruction(
  instruction: ParsedInstructionLike,
  wallet: string,
): number {
  if (!isParsedInstruction(instruction) || !instruction.parsed) {
    return 0;
  }

  const parsed = instruction.parsed as Record<string, unknown>;
  const type = typeof parsed.type === "string" ? parsed.type : null;
  if (type !== "transfer") {
    return 0;
  }

  const info =
    parsed.info && typeof parsed.info === "object"
      ? (parsed.info as Record<string, unknown>)
      : null;
  if (!info) {
    return 0;
  }

  const destination =
    typeof info.destination === "string"
      ? info.destination
      : typeof info.to === "string"
        ? info.to
        : null;
  if (destination !== wallet) {
    return 0;
  }

  if (typeof info.lamports === "number" && Number.isFinite(info.lamports)) {
    return Math.max(0, Math.floor(info.lamports));
  }

  if (typeof info.lamports === "string") {
    const parsedLamports = Number(info.lamports);
    if (Number.isFinite(parsedLamports)) {
      return Math.max(0, Math.floor(parsedLamports));
    }
  }

  return 0;
}

export function extractMemoFromParsedTransaction(
  transaction: ParsedTransactionWithMeta | null,
): string | null {
  if (!transaction) return null;

  for (const instruction of transaction.transaction.message.instructions) {
    const memo = maybeMemoFromInstruction(instruction);
    if (memo) return memo;
  }

  for (const inner of transaction.meta?.innerInstructions ?? []) {
    for (const instruction of inner.instructions) {
      const memo = maybeMemoFromInstruction(instruction);
      if (memo) return memo;
    }
  }

  return null;
}

export function extractLamportsToWalletFromParsedTransaction(
  transaction: ParsedTransactionWithMeta | null,
  wallet: string,
): number {
  if (!transaction) return 0;
  let total = 0;

  for (const instruction of transaction.transaction.message.instructions) {
    total += lamportsToWalletFromInstruction(instruction, wallet);
  }

  for (const inner of transaction.meta?.innerInstructions ?? []) {
    for (const instruction of inner.instructions) {
      total += lamportsToWalletFromInstruction(instruction, wallet);
    }
  }

  return total;
}

export interface OnChainPaymentVerification {
  signature: string;
  confirmed: boolean;
  memo: string | null;
  lamportsToPlatform: number;
}

export async function verifyOnChainPayment(signature: string): Promise<OnChainPaymentVerification> {
  const platformWallet = getPlatformPaymentWallet();

  const [status, transaction] = await Promise.all([
    withSolanaRpcFallback((connection) =>
      connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      }),
    ),
    withSolanaRpcFallback((connection) =>
      connection.getParsedTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }),
    ),
  ]);

  const confirmation = status.value?.confirmationStatus;
  const confirmed =
    confirmation === "confirmed" ||
    confirmation === "finalized" ||
    status.value?.confirmations === null;

  if (!transaction || transaction.meta?.err) {
    return {
      signature,
      confirmed: false,
      memo: null,
      lamportsToPlatform: 0,
    };
  }

  return {
    signature,
    confirmed,
    memo: extractMemoFromParsedTransaction(transaction),
    lamportsToPlatform: extractLamportsToWalletFromParsedTransaction(transaction, platformWallet),
  };
}
