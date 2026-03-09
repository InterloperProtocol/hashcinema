import { round } from "@/lib/utils";
import { NormalizedTrade, WalletMetrics } from "./types";

const EPSILON = 1e-9;

function safeDiv(numerator: number, denominator: number): number {
  if (Math.abs(denominator) <= EPSILON) {
    return 0;
  }
  return numerator / denominator;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function isNightTrade(timestamp: number): boolean {
  const hour = new Date(timestamp * 1000).getUTCHours();
  return hour >= 0 && hour < 6;
}

export function scoreMetrics(input: {
  normalizedTrades: NormalizedTrade[];
  rangeHours: number;
}): WalletMetrics {
  const trades = [...input.normalizedTrades].sort((a, b) => a.timestamp - b.timestamp);
  const buyTrades = trades.filter((trade) => trade.side === "BUY");
  const sellTrades = trades.filter((trade) => trade.side === "SELL");
  const closedSells = sellTrades.filter(
    (trade) => typeof trade.pnlSol === "number" && trade.holdDurationMinutes !== null,
  );

  const tradeCount = trades.length;
  const buyCount = buyTrades.length;
  const sellCount = sellTrades.length;
  const distinctTokenCount = new Set(trades.map((trade) => trade.mint)).size;
  const tradesPerHour = safeDiv(tradeCount, Math.max(1, input.rangeHours));

  let rapidRotationCount = 0;
  for (let index = 1; index < trades.length; index += 1) {
    const prev = trades[index - 1]!;
    const current = trades[index]!;
    if (prev.mint !== current.mint && current.timestamp - prev.timestamp <= 15 * 60) {
      rapidRotationCount += 1;
    }
  }
  const rapidRotationScore = clamp(
    safeDiv(rapidRotationCount, Math.max(1, trades.length - 1)),
  );

  let earlyBuyCount = 0;
  let lateBuyCount = 0;
  for (const buyTrade of buyTrades) {
    const priorBuys = buyTrades.filter(
      (candidate) =>
        candidate.mint === buyTrade.mint &&
        candidate.timestamp < buyTrade.timestamp &&
        buyTrade.timestamp - candidate.timestamp <= 60 * 60,
    );
    const veryRecentBuys = priorBuys.filter(
      (candidate) => buyTrade.timestamp - candidate.timestamp <= 20 * 60,
    );

    if (priorBuys.length === 0) {
      earlyBuyCount += 1;
    }
    if (veryRecentBuys.length >= 2) {
      lateBuyCount += 1;
    }
  }

  const earlyEntryBias = clamp(safeDiv(earlyBuyCount, Math.max(1, buyTrades.length)));
  const lateEntryBias = clamp(safeDiv(lateBuyCount, Math.max(1, buyTrades.length)));

  const losingSells = closedSells.filter((trade) => (trade.pnlSol ?? 0) < 0);
  const rapidReentries = losingSells.reduce((count, losingSell) => {
    const reboundBuy = buyTrades.find(
      (buyTrade) =>
        buyTrade.timestamp > losingSell.timestamp &&
        buyTrade.timestamp <= losingSell.timestamp + 20 * 60,
    );
    return reboundBuy ? count + 1 : count;
  }, 0);
  const rapidReentryScore = clamp(
    safeDiv(rapidReentries, Math.max(1, losingSells.length || buyTrades.length)),
  );

  const nightActivityScore = clamp(
    safeDiv(
      trades.filter((trade) => isNightTrade(trade.timestamp)).length,
      Math.max(1, trades.length),
    ),
  );

  const holdDurations = closedSells
    .map((trade) => trade.holdDurationMinutes ?? 0)
    .filter((value) => value >= 0);
  const avgHoldMinutes = round(average(holdDurations), 2);
  const shortHoldBias = clamp(
    safeDiv(
      holdDurations.filter((value) => value <= 20).length,
      Math.max(1, holdDurations.length),
    ),
  );
  const bagholdBias = clamp(
    safeDiv(
      closedSells.filter((trade) => {
        const hold = trade.holdDurationMinutes ?? 0;
        const pnl = trade.pnlSol ?? 0;
        return hold >= 240 || (pnl < 0 && hold >= 90);
      }).length,
      Math.max(1, closedSells.length),
    ),
  );

  const solAmounts = trades.map((trade) => trade.solAmount);
  const avgSolPerTrade = round(average(solAmounts), 6);
  const sizeVariance = round(
    clamp(safeDiv(standardDeviation(solAmounts), Math.max(EPSILON, avgSolPerTrade)), 0, 4),
    4,
  );

  const mintTradeCounts = new Map<string, number>();
  for (const trade of trades) {
    mintTradeCounts.set(trade.mint, (mintTradeCounts.get(trade.mint) ?? 0) + 1);
  }
  const topMintTrades = [...mintTradeCounts.values()].reduce(
    (max, value) => Math.max(max, value),
    0,
  );
  const concentrationScore = clamp(
    safeDiv(topMintTrades, Math.max(1, tradeCount)),
  );

  const solSpent = buyTrades.reduce((sum, trade) => sum + trade.solAmount, 0);
  const solReceived = sellTrades.reduce((sum, trade) => sum + trade.solAmount, 0);
  const estimatedPnlSol = round(solReceived - solSpent, 6);

  const winningSells = closedSells.filter((trade) => (trade.pnlSol ?? 0) > 0);
  const realizedWinRate = clamp(
    safeDiv(winningSells.length, Math.max(1, closedSells.length)),
  );
  const biggestWin = round(
    closedSells.reduce((max, trade) => Math.max(max, trade.pnlSol ?? 0), 0),
    6,
  );
  const biggestLoss = round(
    closedSells.reduce((min, trade) => Math.min(min, trade.pnlSol ?? 0), 0),
    6,
  );

  const quickMomentumSells = closedSells.filter(
    (trade) => (trade.holdDurationMinutes ?? 0) <= 60,
  );
  const momentumAlignment = clamp(
    safeDiv(
      quickMomentumSells.filter((trade) => (trade.pnlSol ?? 0) > 0).length,
      Math.max(1, quickMomentumSells.length),
    ),
  );

  const chaseScore = clamp(
    lateEntryBias * 0.45 + rapidReentryScore * 0.25 + rapidRotationScore * 0.2 + clamp(tradesPerHour / 2.2) * 0.1,
  );

  const attentionSensitivity = clamp(
    chaseScore * 0.55 + nightActivityScore * 0.2 + rapidRotationScore * 0.25,
  );

  const avgWinnerHold = average(
    winningSells.map((trade) => trade.holdDurationMinutes ?? 0),
  );
  const avgLoserHold = average(
    losingSells.map((trade) => trade.holdDurationMinutes ?? 0),
  );
  const drawdownTolerance = clamp(
    safeDiv(avgLoserHold, Math.max(1, avgWinnerHold || avgHoldMinutes || 1)) / 1.8,
  );
  const panicExitBias = clamp(
    safeDiv(
      losingSells.filter((trade) => (trade.holdDurationMinutes ?? 0) <= 8).length,
      Math.max(1, losingSells.length),
    ),
  );

  let averagingDownCount = 0;
  for (const buyTrade of buyTrades) {
    const previousBuy = [...buyTrades]
      .reverse()
      .find(
        (candidate) =>
          candidate.mint === buyTrade.mint &&
          candidate.timestamp < buyTrade.timestamp &&
          buyTrade.timestamp - candidate.timestamp <= 4 * 60 * 60,
      );

    if (!previousBuy) continue;
    const previousPrice = previousBuy.priceEstimate ?? 0;
    const currentPrice = buyTrade.priceEstimate ?? 0;
    if (previousPrice > EPSILON && currentPrice < previousPrice * 0.9) {
      averagingDownCount += 1;
    }
  }
  const averagingDownBias = clamp(
    safeDiv(averagingDownCount, Math.max(1, buyTrades.length)),
  );

  const revengeBias = rapidReentryScore;
  const chaosScore = clamp(
    clamp(tradesPerHour / 2.2) * 0.25 +
      rapidRotationScore * 0.25 +
      clamp(sizeVariance / 1.5) * 0.25 +
      nightActivityScore * 0.15 +
      rapidReentryScore * 0.1,
  );
  const patienceScore = clamp(
    (1 - shortHoldBias) * 0.5 + (1 - chaosScore) * 0.35 + clamp(avgHoldMinutes / 180) * 0.15,
  );

  const repeatBuyRatio = clamp(
    safeDiv(
      buyTrades.filter((trade) =>
        buyTrades.some(
          (candidate) =>
            candidate !== trade &&
            candidate.mint === trade.mint &&
            candidate.timestamp !== trade.timestamp,
        ),
      ).length,
      Math.max(1, buyTrades.length),
    ),
  );
  const convictionScore = clamp(
    concentrationScore * 0.35 +
      clamp(avgHoldMinutes / 180) * 0.25 +
      repeatBuyRatio * 0.2 +
      (1 - shortHoldBias) * 0.2,
  );

  const swingMagnitude = Math.max(Math.abs(biggestWin), Math.abs(biggestLoss));
  const swingScore = clamp(
    safeDiv(swingMagnitude, Math.max(0.2, avgSolPerTrade * 1.6)),
  );
  const comebackFactor = estimatedPnlSol > 0 && biggestLoss < 0 ? 1 : 0.25;

  const memeabilityScore = clamp(
    chaosScore * 0.35 +
      nightActivityScore * 0.15 +
      revengeBias * 0.2 +
      bagholdBias * 0.15 +
      swingScore * 0.15,
  );

  const shareabilityScore = clamp(
    memeabilityScore * 0.4 + swingScore * 0.25 + chaseScore * 0.2 + comebackFactor * 0.15,
  );

  const cinemaScore = clamp(
    shareabilityScore * 0.4 + swingScore * 0.25 + chaosScore * 0.2 + comebackFactor * 0.15,
  );

  return {
    activity: {
      tradeCount,
      distinctTokenCount,
      buyCount,
      sellCount,
      tradesPerHour: round(tradesPerHour, 4),
      rapidRotationScore: round(rapidRotationScore, 4),
    },
    timing: {
      earlyEntryBias: round(earlyEntryBias, 4),
      lateEntryBias: round(lateEntryBias, 4),
      rapidReentryScore: round(rapidReentryScore, 4),
      nightActivityScore: round(nightActivityScore, 4),
    },
    holding: {
      avgHoldMinutes,
      shortHoldBias: round(shortHoldBias, 4),
      bagholdBias: round(bagholdBias, 4),
    },
    sizing: {
      avgSolPerTrade,
      sizeVariance,
      concentrationScore: round(concentrationScore, 4),
    },
    pnl: {
      estimatedPnlSol,
      realizedWinRate: round(realizedWinRate, 4),
      biggestWin,
      biggestLoss,
    },
    attention: {
      chaseScore: round(chaseScore, 4),
      momentumAlignment: round(momentumAlignment, 4),
      attentionSensitivity: round(attentionSensitivity, 4),
    },
    risk: {
      drawdownTolerance: round(drawdownTolerance, 4),
      panicExitBias: round(panicExitBias, 4),
      averagingDownBias: round(averagingDownBias, 4),
    },
    behavior: {
      revengeBias: round(revengeBias, 4),
      chaosScore: round(chaosScore, 4),
      patienceScore: round(patienceScore, 4),
      convictionScore: round(convictionScore, 4),
    },
    virality: {
      memeabilityScore: round(memeabilityScore, 4),
      shareabilityScore: round(shareabilityScore, 4),
      cinemaScore: round(cinemaScore, 4),
    },
  };
}
