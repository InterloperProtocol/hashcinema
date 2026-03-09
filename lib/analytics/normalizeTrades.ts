import { PumpTradeLike, NormalizedTrade } from "./types";

const EPSILON = 1e-9;

interface OpenLot {
  mint: string;
  remainingTokenAmount: number;
  remainingEntrySol: number;
  entryTimestamp: number;
  entrySignature: string;
  buyIndex: number;
}

function safeDiv(numerator: number, denominator: number): number {
  if (Math.abs(denominator) <= EPSILON) {
    return 0;
  }
  return numerator / denominator;
}

export function normalizeTrades(trades: PumpTradeLike[]): NormalizedTrade[] {
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  const normalized: NormalizedTrade[] = [];
  const openLotsByMint = new Map<string, OpenLot[]>();

  for (const trade of sorted) {
    const tokenAmount = Math.max(0, trade.tokenAmount ?? 0);
    const solAmount = Math.max(0, trade.solAmount ?? 0);
    const side = trade.side === "buy" ? "BUY" : "SELL";

    if (side === "BUY") {
      const normalizedTrade: NormalizedTrade = {
        signature: trade.signature,
        timestamp: trade.timestamp,
        mint: trade.mint,
        symbol: trade.symbol,
        name: trade.name,
        image: trade.image ?? undefined,
        side,
        solAmount,
        tokenAmount,
        priceEstimate: tokenAmount > EPSILON ? safeDiv(solAmount, tokenAmount) : undefined,
        holdDurationMinutes: null,
        pnlSol: null,
        isOpenPosition: false,
        isPumpToken: true,
      };

      normalized.push(normalizedTrade);
      const lots = openLotsByMint.get(trade.mint) ?? [];
      lots.push({
        mint: trade.mint,
        remainingTokenAmount: tokenAmount,
        remainingEntrySol: solAmount,
        entryTimestamp: trade.timestamp,
        entrySignature: trade.signature,
        buyIndex: normalized.length - 1,
      });
      openLotsByMint.set(trade.mint, lots);
      continue;
    }

    const lots = openLotsByMint.get(trade.mint) ?? [];
    let remainingToMatch = tokenAmount;
    let matchedToken = 0;
    let matchedEntrySol = 0;
    let weightedHoldMinutes = 0;

    while (remainingToMatch > EPSILON && lots.length) {
      const lot = lots[0]!;
      if (lot.remainingTokenAmount <= EPSILON) {
        lots.shift();
        continue;
      }

      const filled = Math.min(remainingToMatch, lot.remainingTokenAmount);
      const entrySol = safeDiv(lot.remainingEntrySol * filled, lot.remainingTokenAmount);
      const holdMinutes = Math.max(0, trade.timestamp - lot.entryTimestamp) / 60;

      matchedToken += filled;
      matchedEntrySol += entrySol;
      weightedHoldMinutes += holdMinutes * filled;

      lot.remainingTokenAmount -= filled;
      lot.remainingEntrySol -= entrySol;
      remainingToMatch -= filled;

      if (lot.remainingTokenAmount <= EPSILON) {
        lots.shift();
      }
    }

    if (lots.length) {
      openLotsByMint.set(trade.mint, lots);
    } else {
      openLotsByMint.delete(trade.mint);
    }

    const holdDurationMinutes =
      matchedToken > EPSILON ? safeDiv(weightedHoldMinutes, matchedToken) : null;
    const pnlSol = matchedToken > EPSILON ? solAmount - matchedEntrySol : null;

    normalized.push({
      signature: trade.signature,
      timestamp: trade.timestamp,
      mint: trade.mint,
      symbol: trade.symbol,
      name: trade.name,
      image: trade.image ?? undefined,
      side,
      solAmount,
      tokenAmount,
      priceEstimate: tokenAmount > EPSILON ? safeDiv(solAmount, tokenAmount) : undefined,
      holdDurationMinutes,
      pnlSol,
      isOpenPosition: false,
      isPumpToken: true,
    });
  }

  for (const lots of openLotsByMint.values()) {
    for (const lot of lots) {
      if (lot.remainingTokenAmount <= EPSILON) {
        continue;
      }
      const buyTrade = normalized[lot.buyIndex];
      if (buyTrade && buyTrade.side === "BUY") {
        buyTrade.isOpenPosition = true;
      }
    }
  }

  return normalized;
}
