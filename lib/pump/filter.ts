import { PUMP_SOURCES } from "@/lib/constants";
import { getOrFetchPumpMetadata } from "@/lib/pump/metadata";
import { PumpTrade } from "@/lib/types/domain";
import { asNumber, toSol } from "@/lib/utils";
import type {
  EnhancedTokenTransfer,
  EnhancedTransaction,
} from "helius-sdk/enhanced/types";

const SOL_MINT = "So11111111111111111111111111111111111111112";

function parseTokenAmount(transfer: EnhancedTokenTransfer): number {
  const raw = asNumber(transfer.tokenAmount);
  if (!transfer.decimals || raw <= 0) {
    return raw;
  }

  if (raw >= 10 ** transfer.decimals) {
    return raw / 10 ** transfer.decimals;
  }

  return raw;
}

export async function extractPumpTrades(
  wallet: string,
  transactions: EnhancedTransaction[],
): Promise<PumpTrade[]> {
  const walletLc = wallet.toLowerCase();
  const candidates: Array<{
    timestamp: number;
    signature: string;
    source: string;
    mint: string;
    side: "buy" | "sell";
    tokenAmount: number;
    solAmount: number;
  }> = [];

  for (const tx of transactions) {
    if (tx.transactionError) {
      continue;
    }

    const source = (tx.source ?? "UNKNOWN").toUpperCase();
    const isPumpSource =
      PUMP_SOURCES.has(source) ||
      (tx.description ?? "").toLowerCase().includes("pump.fun");

    const tokenTransfers = (tx.tokenTransfers ?? []).filter((transfer) => {
      const from = transfer.fromUserAccount?.toLowerCase();
      const to = transfer.toUserAccount?.toLowerCase();
      const touchesWallet = from === walletLc || to === walletLc;
      return touchesWallet && transfer.mint && transfer.mint !== SOL_MINT;
    });

    if (!tokenTransfers.length) {
      continue;
    }

    const solSpent = (tx.nativeTransfers ?? [])
      .filter((nativeTransfer) => nativeTransfer.fromUserAccount === wallet)
      .reduce((sum, nativeTransfer) => sum + toSol(nativeTransfer.amount), 0);

    const solReceived = (tx.nativeTransfers ?? [])
      .filter((nativeTransfer) => nativeTransfer.toUserAccount === wallet)
      .reduce((sum, nativeTransfer) => sum + toSol(nativeTransfer.amount), 0);

    const buyCount = tokenTransfers.filter(
      (transfer) => transfer.toUserAccount?.toLowerCase() === walletLc,
    ).length;
    const sellCount = tokenTransfers.filter(
      (transfer) => transfer.fromUserAccount?.toLowerCase() === walletLc,
    ).length;

    for (const transfer of tokenTransfers) {
      const isBuy = transfer.toUserAccount?.toLowerCase() === walletLc;
      const side: "buy" | "sell" = isBuy ? "buy" : "sell";

      candidates.push({
        timestamp: tx.timestamp ?? 0,
        signature: tx.signature,
        source: isPumpSource ? "PUMP_FUN" : source,
        mint: transfer.mint,
        side,
        tokenAmount: parseTokenAmount(transfer),
        solAmount:
          side === "buy"
            ? solSpent / Math.max(1, buyCount)
            : solReceived / Math.max(1, sellCount),
      });
    }
  }

  const uniqueMints = [...new Set(candidates.map((candidate) => candidate.mint))];
  const metadataEntries = await Promise.all(
    uniqueMints.map(
      async (mint) => [mint, await getOrFetchPumpMetadata(mint)] as const,
    ),
  );
  const metadataMap = new Map(metadataEntries);

  return candidates
    .map((candidate): PumpTrade | null => {
      const metadata = metadataMap.get(candidate.mint);
      if (!metadata) {
        return null;
      }

      const isPumpTrade =
        candidate.source === "PUMP_FUN" || metadata.isPump === true;
      if (!isPumpTrade) {
        return null;
      }

      return {
        timestamp: candidate.timestamp,
        signature: candidate.signature,
        source: candidate.source,
        mint: candidate.mint,
        symbol: metadata.symbol,
        name: metadata.name,
        image: metadata.image,
        side: candidate.side,
        tokenAmount: candidate.tokenAmount,
        solAmount: candidate.solAmount,
      };
    })
    .filter((trade): trade is PumpTrade => trade !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
}
