import { PUMP_SOURCES } from "@/lib/constants";
import { logger } from "@/lib/logging/logger";
import { getOrFetchPumpMetadata, PumpTokenMetadata } from "@/lib/pump/metadata";
import { PumpTrade } from "@/lib/types/domain";
import { asNumber, toSol } from "@/lib/utils";
import type {
  EnhancedTokenTransfer,
  EnhancedTransaction,
} from "helius-sdk/enhanced/types";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const METADATA_CONCURRENCY_LIMIT = 6;
const METADATA_TIMEOUT_MS = 12_000;

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

function createFallbackMetadata(
  mint: string,
  hasPumpSource: boolean,
): PumpTokenMetadata {
  return {
    mint,
    name: mint.slice(0, 6),
    symbol: "UNKNOWN",
    image: null,
    description: null,
    isPump: hasPumpSource,
  };
}

async function withTimeout<T>(input: {
  operation: () => Promise<T>;
  timeoutMs: number;
  timeoutMessage: string;
}): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(input.timeoutMessage));
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([input.operation(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: safeLimit }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
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

  const mintStats = new Map<string, { count: number; hasPumpSource: boolean }>();
  for (const candidate of candidates) {
    const existing = mintStats.get(candidate.mint);
    if (!existing) {
      mintStats.set(candidate.mint, {
        count: 1,
        hasPumpSource: candidate.source === "PUMP_FUN",
      });
      continue;
    }

    existing.count += 1;
    if (candidate.source === "PUMP_FUN") {
      existing.hasPumpSource = true;
    }
  }

  const uniqueMints = [...mintStats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([mint]) => mint);

  const metadataEntries = await mapWithConcurrency(
    uniqueMints,
    METADATA_CONCURRENCY_LIMIT,
    async (mint) => {
      try {
        const metadata = await withTimeout({
          operation: () => getOrFetchPumpMetadata(mint),
          timeoutMs: METADATA_TIMEOUT_MS,
          timeoutMessage: `Pump metadata timeout after ${METADATA_TIMEOUT_MS}ms for mint ${mint}`,
        });

        return [mint, metadata] as const;
      } catch (error) {
        const fallback = createFallbackMetadata(
          mint,
          mintStats.get(mint)?.hasPumpSource === true,
        );

        logger.warn("pump_metadata_enrichment_failed", {
          component: "pump_filter",
          stage: "enrich_pump_metadata",
          mint,
          errorCode: "pump_metadata_enrichment_failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });

        return [mint, fallback] as const;
      }
    },
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
