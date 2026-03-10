import {
  PumpTrade,
  ReportDocument,
  ReportTimelineItem,
  WalletBehavioralMetrics,
  WalletKeyEvent,
  WalletProfile,
  WalletStory,
} from "@/lib/types/domain";
import { round } from "@/lib/utils";

const EPSILON = 1e-9;
const NIGHT_START_UTC = 0;
const NIGHT_END_UTC = 6;

interface ClosedTradeRecord {
  mint: string;
  symbol: string;
  tokenAmount: number;
  entryTime: number;
  exitTime: number;
  entrySignature: string;
  exitSignature: string;
  entryMarketContext: string;
  exitMarketContext: string;
  entryValueSol: number;
  exitValueSol: number;
  holdingDurationSec: number;
  netOutcomeSol: number;
}

interface OpenPositionRecord {
  mint: string;
  symbol: string;
  tokenAmount: number;
  entryTime: number;
  entrySignature: string;
  entryMarketContext: string;
  entryValueSol: number;
}

interface OpenLot {
  mint: string;
  symbol: string;
  remainingTokenAmount: number;
  remainingEntrySol: number;
  entryTime: number;
  entrySignature: string;
  entryMarketContext: string;
}

interface BehavioralPattern {
  code: string;
  label: string;
  weight: number;
  summary: string;
}

interface BehaviorDetails {
  rapidFlipCount: number;
  lateMomentumEntryCount: number;
  prematureExitCount: number;
  rapidRotationCount: number;
  nightTradeCount: number;
  postLossReentryCount: number;
  losersHeldLonger: boolean;
}

interface BehaviorComputation {
  metrics: WalletBehavioralMetrics;
  details: BehaviorDetails;
}

export interface ComputedAnalytics {
  report: Omit<ReportDocument, "summary" | "downloadUrl">;
  story: Omit<WalletStory, "analytics"> & {
    analytics: WalletStory["analytics"];
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function safeDiv(numerator: number, denominator: number): number {
  if (Math.abs(denominator) <= EPSILON) {
    return 0;
  }
  return numerator / denominator;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isNightTrade(timestamp: number): boolean {
  const hour = new Date(timestamp * 1000).getUTCHours();
  return hour >= NIGHT_START_UTC && hour < NIGHT_END_UTC;
}

function formatSignedSol(value: number): string {
  const rounded = round(value);
  return `${rounded >= 0 ? "+" : ""}${rounded} SOL`;
}

function formatHoldDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

function buildTimeline(trades: PumpTrade[]): ReportTimelineItem[] {
  return trades.slice(-80).map((trade) => ({
    timestamp: trade.timestamp,
    signature: trade.signature,
    mint: trade.mint,
    symbol: trade.symbol,
    name: trade.name,
    image: trade.image,
    side: trade.side,
    tokenAmount: round(trade.tokenAmount, 6),
    solAmount: round(trade.solAmount, 6),
  }));
}

function marketContextForTrade(trades: PumpTrade[], index: number): string {
  const trade = trades[index];
  if (!trade) return "unknown market context";

  const lookbackStart = trade.timestamp - 10 * 60;
  const recentSameTokenBuys = trades
    .slice(0, index)
    .filter(
      (candidate) =>
        candidate.side === "buy" &&
        candidate.mint === trade.mint &&
        candidate.timestamp >= lookbackStart,
    ).length;

  const previousTrade = index > 0 ? trades[index - 1] : null;
  const gapFromPrevious = previousTrade
    ? Math.max(0, trade.timestamp - previousTrade.timestamp)
    : Number.POSITIVE_INFINITY;

  if (trade.side === "buy" && recentSameTokenBuys >= 2) {
    return "late momentum entry";
  }
  if (trade.side === "buy" && gapFromPrevious <= 120) {
    return "rapid market burst entry";
  }
  if (trade.side === "sell" && recentSameTokenBuys >= 2) {
    return "exit into momentum";
  }
  if (trade.side === "sell" && gapFromPrevious <= 180) {
    return "quick reaction exit";
  }

  return "calmer tape execution";
}

function mergeClosedTrades(trades: ClosedTradeRecord[]): ClosedTradeRecord[] {
  const grouped = new Map<string, ClosedTradeRecord>();

  for (const trade of trades) {
    const key = `${trade.mint}|${trade.entrySignature}|${trade.exitSignature}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...trade });
      continue;
    }

    const mergedTokenAmount = existing.tokenAmount + trade.tokenAmount;
    const weightedHold = safeDiv(
      existing.holdingDurationSec * existing.tokenAmount +
        trade.holdingDurationSec * trade.tokenAmount,
      mergedTokenAmount,
    );

    grouped.set(key, {
      ...existing,
      tokenAmount: mergedTokenAmount,
      entryTime: Math.min(existing.entryTime, trade.entryTime),
      exitTime: Math.max(existing.exitTime, trade.exitTime),
      entryValueSol: existing.entryValueSol + trade.entryValueSol,
      exitValueSol: existing.exitValueSol + trade.exitValueSol,
      netOutcomeSol:
        existing.entryValueSol +
        trade.entryValueSol <= EPSILON &&
        existing.exitValueSol + trade.exitValueSol <= EPSILON
          ? 0
          : existing.exitValueSol +
            trade.exitValueSol -
            (existing.entryValueSol + trade.entryValueSol),
      holdingDurationSec: Math.max(0, Math.round(weightedHold)),
    });
  }

  return [...grouped.values()].sort((a, b) => a.exitTime - b.exitTime);
}

function normalizeTrades(trades: PumpTrade[]): {
  closedTrades: ClosedTradeRecord[];
  openPositions: OpenPositionRecord[];
} {
  const openLotsByMint = new Map<string, OpenLot[]>();
  const closed: ClosedTradeRecord[] = [];

  for (let index = 0; index < trades.length; index += 1) {
    const trade = trades[index]!;
    const marketContext = marketContextForTrade(trades, index);

    if (trade.side === "buy") {
      const lots = openLotsByMint.get(trade.mint) ?? [];
      lots.push({
        mint: trade.mint,
        symbol: trade.symbol,
        remainingTokenAmount: Math.max(EPSILON, trade.tokenAmount),
        remainingEntrySol: Math.max(0, trade.solAmount),
        entryTime: trade.timestamp,
        entrySignature: trade.signature,
        entryMarketContext: marketContext,
      });
      openLotsByMint.set(trade.mint, lots);
      continue;
    }

    const lots = openLotsByMint.get(trade.mint) ?? [];
    if (!lots.length || trade.tokenAmount <= EPSILON) {
      continue;
    }

    let remainingToMatch = trade.tokenAmount;
    const sellSolPerToken = safeDiv(trade.solAmount, trade.tokenAmount);

    while (remainingToMatch > EPSILON && lots.length) {
      const lot = lots[0]!;
      if (lot.remainingTokenAmount <= EPSILON) {
        lots.shift();
        continue;
      }

      const matchedToken = Math.min(lot.remainingTokenAmount, remainingToMatch);
      const entryValueSol = safeDiv(
        lot.remainingEntrySol * matchedToken,
        lot.remainingTokenAmount,
      );
      const exitValueSol = sellSolPerToken * matchedToken;
      const holdingDurationSec = Math.max(0, trade.timestamp - lot.entryTime);

      closed.push({
        mint: trade.mint,
        symbol: trade.symbol,
        tokenAmount: matchedToken,
        entryTime: lot.entryTime,
        exitTime: trade.timestamp,
        entrySignature: lot.entrySignature,
        exitSignature: trade.signature,
        entryMarketContext: lot.entryMarketContext,
        exitMarketContext: marketContext,
        entryValueSol,
        exitValueSol,
        holdingDurationSec,
        netOutcomeSol: exitValueSol - entryValueSol,
      });

      lot.remainingTokenAmount -= matchedToken;
      lot.remainingEntrySol -= entryValueSol;
      remainingToMatch -= matchedToken;

      if (lot.remainingTokenAmount <= EPSILON) {
        lots.shift();
      }
    }

    if (lots.length) {
      openLotsByMint.set(trade.mint, lots);
    } else {
      openLotsByMint.delete(trade.mint);
    }
  }

  const mergedClosed = mergeClosedTrades(closed);

  const openPositions: OpenPositionRecord[] = [];
  for (const lots of openLotsByMint.values()) {
    for (const lot of lots) {
      if (lot.remainingTokenAmount <= EPSILON || lot.remainingEntrySol <= EPSILON) {
        continue;
      }
      openPositions.push({
        mint: lot.mint,
        symbol: lot.symbol,
        tokenAmount: lot.remainingTokenAmount,
        entryTime: lot.entryTime,
        entrySignature: lot.entrySignature,
        entryMarketContext: lot.entryMarketContext,
        entryValueSol: lot.remainingEntrySol,
      });
    }
  }

  openPositions.sort((a, b) => a.entryTime - b.entryTime);

  return {
    closedTrades: mergedClosed,
    openPositions,
  };
}

function computeBehaviorMetrics(input: {
  trades: PumpTrade[];
  closedTrades: ClosedTradeRecord[];
  openPositions: OpenPositionRecord[];
  rangeDays: number;
}): BehaviorComputation {
  const { trades, closedTrades, openPositions, rangeDays } = input;
  const buyTrades = trades.filter((trade) => trade.side === "buy");
  const sellTrades = trades.filter((trade) => trade.side === "sell");

  const gapsInMinutes: number[] = [];
  for (let index = 1; index < trades.length; index += 1) {
    const gapSeconds = Math.max(0, trades[index]!.timestamp - trades[index - 1]!.timestamp);
    gapsInMinutes.push(gapSeconds / 60);
  }

  const lateMomentumEntryCount = buyTrades.reduce((count, trade) => {
    const recentWindowStart = trade.timestamp - 10 * 60;
    const recentSameTokenBuys = buyTrades.filter(
      (candidate) =>
        candidate.timestamp < trade.timestamp &&
        candidate.timestamp >= recentWindowStart &&
        candidate.mint === trade.mint,
    ).length;
    return recentSameTokenBuys >= 1 ? count + 1 : count;
  }, 0);

  const holdDurationsMinutes = closedTrades.map(
    (trade) => trade.holdingDurationSec / 60,
  );
  const winnerHolds = closedTrades
    .filter((trade) => trade.netOutcomeSol > 0)
    .map((trade) => trade.holdingDurationSec / 60);
  const loserHolds = closedTrades
    .filter((trade) => trade.netOutcomeSol < 0)
    .map((trade) => trade.holdingDurationSec / 60);

  const rapidFlipCount = closedTrades.filter(
    (trade) => trade.holdingDurationSec <= 5 * 60,
  ).length;
  const prematureExitCount = closedTrades.filter(
    (trade) => trade.holdingDurationSec <= 15 * 60,
  ).length;

  let rapidRotationCount = 0;
  for (let index = 1; index < trades.length; index += 1) {
    const previous = trades[index - 1]!;
    const current = trades[index]!;
    if (
      previous.mint !== current.mint &&
      current.timestamp - previous.timestamp <= 10 * 60
    ) {
      rapidRotationCount += 1;
    }
  }

  const losingTrades = closedTrades
    .filter((trade) => trade.netOutcomeSol < 0)
    .sort((a, b) => a.exitTime - b.exitTime);
  const postLossReentryCount = losingTrades.reduce((count, lossTrade) => {
    const reentry = trades.find(
      (trade) =>
        trade.side === "buy" &&
        trade.timestamp > lossTrade.exitTime &&
        trade.timestamp <= lossTrade.exitTime + 15 * 60,
    );
    return reentry ? count + 1 : count;
  }, 0);

  const nightTradeCount = trades.filter((trade) =>
    isNightTrade(trade.timestamp),
  ).length;

  const tokenTradeCounts = new Map<string, number>();
  for (const trade of trades) {
    tokenTradeCounts.set(trade.mint, (tokenTradeCounts.get(trade.mint) ?? 0) + 1);
  }
  const maxTokenCount = [...tokenTradeCounts.values()].reduce(
    (max, value) => Math.max(max, value),
    0,
  );

  const buySizes = buyTrades.map((trade) => trade.solAmount);
  const buySizeMean = average(buySizes);
  const buySizeStd = standardDeviation(buySizes);

  const averageWinnerHold = average(winnerHolds);
  const averageLoserHold = average(loserHolds);

  const metrics: WalletBehavioralMetrics = {
    totalTrades: trades.length,
    buyCount: buyTrades.length,
    sellCount: sellTrades.length,
    closedTradeCount: closedTrades.length,
    openPositionCount: openPositions.length,
    tradesPerDay: round(safeDiv(trades.length, Math.max(1, rangeDays))),
    medianMinutesBetweenTrades: round(median(gapsInMinutes)),
    nightTradeRatio: round(safeDiv(nightTradeCount, Math.max(1, trades.length))),
    lateMomentumEntryRatio: round(
      safeDiv(lateMomentumEntryCount, Math.max(1, buyTrades.length)),
    ),
    prematureExitRatio: round(
      safeDiv(prematureExitCount, Math.max(1, closedTrades.length)),
    ),
    rapidFlipRatio: round(safeDiv(rapidFlipCount, Math.max(1, closedTrades.length))),
    rapidRotationRatio: round(
      safeDiv(rapidRotationCount, Math.max(1, trades.length - 1)),
    ),
    postLossReentryCount,
    averageHoldingMinutes: round(average(holdDurationsMinutes)),
    medianHoldingMinutes: round(median(holdDurationsMinutes)),
    averageWinnerHoldMinutes: round(averageWinnerHold),
    averageLoserHoldMinutes: round(averageLoserHold),
    positionSizeConsistency: round(safeDiv(buySizeStd, Math.max(EPSILON, buySizeMean))),
    tokenConcentration: round(safeDiv(maxTokenCount, Math.max(1, trades.length))),
  };

  const details: BehaviorDetails = {
    rapidFlipCount,
    lateMomentumEntryCount,
    prematureExitCount,
    rapidRotationCount,
    nightTradeCount,
    postLossReentryCount,
    losersHeldLonger:
      winnerHolds.length > 0 &&
      loserHolds.length > 0 &&
      averageLoserHold > averageWinnerHold * 1.4 &&
      averageLoserHold > 15,
  };

  return { metrics, details };
}

function detectBehaviorPatterns(input: {
  metrics: WalletBehavioralMetrics;
  details: BehaviorDetails;
}): BehavioralPattern[] {
  const { metrics, details } = input;
  const patterns: BehavioralPattern[] = [];

  const addPattern = (
    code: string,
    label: string,
    rawWeight: number,
    summary: string,
  ) => {
    patterns.push({
      code,
      label,
      weight: round(clamp(rawWeight, 1, 5), 2),
      summary,
    });
  };

  if (details.rapidFlipCount >= 3 && metrics.rapidFlipRatio >= 0.3) {
    addPattern(
      "rapid_flipping",
      "Repeated Rapid Flipping",
      metrics.rapidFlipRatio * 7,
      `${details.rapidFlipCount}/${metrics.closedTradeCount} closed positions were flipped in five minutes or less.`,
    );
  }

  if (details.lateMomentumEntryCount >= 3 && metrics.lateMomentumEntryRatio >= 0.35) {
    addPattern(
      "late_momentum_entries",
      "Late Momentum Entries",
      metrics.lateMomentumEntryRatio * 7,
      `${details.lateMomentumEntryCount}/${metrics.buyCount} buys arrived after momentum was already active.`,
    );
  }

  if (details.prematureExitCount >= 4 && metrics.prematureExitRatio >= 0.45) {
    addPattern(
      "premature_exits",
      "Premature Exit Bias",
      metrics.prematureExitRatio * 6,
      `${details.prematureExitCount}/${metrics.closedTradeCount} exits happened inside 15 minutes.`,
    );
  }

  if (details.losersHeldLonger) {
    addPattern(
      "loss_holding_bias",
      "Loss-Holding Bias",
      safeDiv(metrics.averageLoserHoldMinutes, Math.max(1, metrics.averageWinnerHoldMinutes)),
      `Losing holds averaged ${metrics.averageLoserHoldMinutes}m vs ${metrics.averageWinnerHoldMinutes}m on winners.`,
    );
  }

  if (details.postLossReentryCount >= 2) {
    addPattern(
      "revenge_reentries",
      "Post-Loss Re-entry Spurts",
      1 + details.postLossReentryCount * 0.8,
      `${details.postLossReentryCount} buys happened within 15 minutes of a losing exit.`,
    );
  }

  if (details.nightTradeCount >= 4 && metrics.nightTradeRatio >= 0.45) {
    addPattern(
      "night_shift_activity",
      "High Nighttime Activity",
      metrics.nightTradeRatio * 6,
      `${details.nightTradeCount}/${metrics.totalTrades} trades were executed between 00:00 and 06:00 UTC.`,
    );
  }

  if (details.rapidRotationCount >= 3 && metrics.rapidRotationRatio >= 0.35) {
    addPattern(
      "rapid_rotation",
      "Rapid Token Rotation",
      metrics.rapidRotationRatio * 7,
      `${details.rapidRotationCount} fast rotations switched tokens in under 10 minutes.`,
    );
  }

  if (metrics.tokenConcentration >= 0.55 && metrics.totalTrades >= 6) {
    addPattern(
      "concentrated_bets",
      "Concentrated Positioning",
      metrics.tokenConcentration * 5,
      `A single token represented ${(metrics.tokenConcentration * 100).toFixed(0)}% of all trades.`,
    );
  }

  patterns.sort((a, b) => b.weight - a.weight);
  return patterns;
}

function classifyTradingStyle(
  metrics: WalletBehavioralMetrics,
  patterns: BehavioralPattern[],
): string {
  if (metrics.totalTrades === 0) {
    return "No Pump Activity";
  }

  if (
    patterns.some((pattern) => pattern.code === "rapid_flipping") &&
    metrics.totalTrades >= 12
  ) {
    return "Hyperactive Scalp Rotation";
  }

  if (patterns.some((pattern) => pattern.code === "concentrated_bets")) {
    return "Single-Token Conviction Runs";
  }

  if (patterns.some((pattern) => pattern.code === "late_momentum_entries")) {
    return "Momentum Chase Entries";
  }

  if (metrics.averageHoldingMinutes >= 180) {
    return "Extended Swing Holding";
  }

  return "Mixed Tactical Rotation";
}

function assignWalletPersonality(input: {
  patterns: BehavioralPattern[];
  metrics: WalletBehavioralMetrics;
  estimatedPnlSol: number;
}): { primary: string; secondary: string | null } {
  if (input.metrics.totalTrades === 0) {
    return { primary: "No Signal Yet", secondary: null };
  }

  const scores: Record<string, number> = {
    "Momentum Sniper": 0,
    "Rapid-Fire Flipper": 0,
    "Hope-Mode Holder": 0,
    "Revenge Rotator": 0,
    "Night Shift Hunter": 0,
    "Balanced Opportunist": 0,
  };

  for (const pattern of input.patterns) {
    switch (pattern.code) {
      case "rapid_flipping":
        scores["Rapid-Fire Flipper"] += pattern.weight * 1.9;
        scores["Momentum Sniper"] += pattern.weight * 0.8;
        break;
      case "late_momentum_entries":
        scores["Momentum Sniper"] += pattern.weight * 2;
        break;
      case "premature_exits":
        scores["Rapid-Fire Flipper"] += pattern.weight * 1.2;
        scores["Momentum Sniper"] += pattern.weight * 0.7;
        break;
      case "loss_holding_bias":
        scores["Hope-Mode Holder"] += pattern.weight * 2.1;
        break;
      case "revenge_reentries":
        scores["Revenge Rotator"] += pattern.weight * 2.2;
        scores["Rapid-Fire Flipper"] += pattern.weight * 0.4;
        break;
      case "night_shift_activity":
        scores["Night Shift Hunter"] += pattern.weight * 2.2;
        break;
      case "rapid_rotation":
        scores["Momentum Sniper"] += pattern.weight * 1.2;
        scores["Revenge Rotator"] += pattern.weight * 0.7;
        break;
      case "concentrated_bets":
        scores["Hope-Mode Holder"] += pattern.weight * 0.6;
        scores["Balanced Opportunist"] += pattern.weight * 0.4;
        break;
      default:
        break;
    }
  }

  if (input.patterns.length <= 2 && input.metrics.positionSizeConsistency <= 0.55) {
    scores["Balanced Opportunist"] += 2.2;
  }

  if (input.estimatedPnlSol > 0 && input.metrics.prematureExitRatio < 0.4) {
    scores["Balanced Opportunist"] += 1.1;
  }

  if (input.metrics.nightTradeRatio < 0.25 && input.metrics.medianMinutesBetweenTrades >= 12) {
    scores["Balanced Opportunist"] += 0.9;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [primary, primaryScore] = ranked[0] ?? ["Balanced Opportunist", 0];
  const [secondary, secondaryScore] = ranked[1] ?? [null, 0];

  const secondaryPersonality =
    secondary && secondaryScore >= primaryScore * 0.72 && secondaryScore >= 1.6
      ? secondary
      : null;

  return { primary, secondary: secondaryPersonality };
}

function deriveModifiers(input: {
  metrics: WalletBehavioralMetrics;
  patterns: BehavioralPattern[];
}): string[] {
  if (input.metrics.totalTrades === 0) {
    return ["Insufficient Pump Trade Activity"];
  }

  const modifiers = new Set<string>();
  const { metrics } = input;

  if (metrics.nightTradeRatio >= 0.45) {
    modifiers.add("Night Trading Tendencies");
  } else if (metrics.nightTradeRatio <= 0.15) {
    modifiers.add("Daylight Discipline");
  }

  if (metrics.postLossReentryCount >= 2) {
    modifiers.add("Rapid Re-entry Behavior");
  } else if (metrics.postLossReentryCount === 0 && metrics.closedTradeCount >= 3) {
    modifiers.add("Post-Loss Cooldown Discipline");
  }

  if (metrics.positionSizeConsistency >= 0.9) {
    modifiers.add("Volatile Bet Sizing");
  } else if (metrics.positionSizeConsistency <= 0.45) {
    modifiers.add("Consistent Position Sizing");
  }

  if (metrics.tokenConcentration >= 0.55) {
    modifiers.add("Position Concentration Habit");
  } else if (metrics.tokenConcentration <= 0.3 && metrics.totalTrades >= 10) {
    modifiers.add("Wide Rotation Habit");
  }

  if (metrics.medianMinutesBetweenTrades <= 8) {
    modifiers.add("High Impulsivity Signals");
  } else if (metrics.medianMinutesBetweenTrades >= 45) {
    modifiers.add("Measured Execution Tempo");
  }

  if (
    metrics.averageLoserHoldMinutes >
      metrics.averageWinnerHoldMinutes * 1.4 &&
    metrics.averageLoserHoldMinutes > 15
  ) {
    modifiers.add("Loss-Holding Bias");
  }

  if (metrics.rapidFlipRatio >= 0.35) {
    modifiers.add("Rapid Flip Reflex");
  }

  for (const pattern of input.patterns.slice(0, 2)) {
    if (modifiers.size >= 5) break;
    modifiers.add(pattern.label);
  }

  if (modifiers.size < 2) {
    modifiers.add("Momentum Reactivity");
    modifiers.add("Adaptive Rotation");
  }

  return [...modifiers].slice(0, 6);
}

function buildBehavioralSummary(
  patterns: BehavioralPattern[],
  metrics: WalletBehavioralMetrics,
): string[] {
  if (metrics.totalTrades === 0) {
    return ["No Pump trades were detected in the selected analysis window."];
  }

  if (patterns.length) {
    return patterns.slice(0, 5).map((pattern) => pattern.summary);
  }

  return [
    `Executed ${metrics.totalTrades} trades with ${metrics.tradesPerDay} trades/day pacing.`,
    `Median spacing between trades was ${metrics.medianMinutesBetweenTrades} minutes.`,
    `Rotation intensity landed at ${(metrics.rapidRotationRatio * 100).toFixed(0)}% rapid switches.`,
  ];
}

function extractKeyEvents(input: {
  closedTrades: ClosedTradeRecord[];
  trades: PumpTrade[];
}): WalletKeyEvent[] {
  const { closedTrades, trades } = input;
  const keyEvents: WalletKeyEvent[] = [];

  const sortedClosed = [...closedTrades].sort((a, b) => a.exitTime - b.exitTime);
  const largestGain = sortedClosed.reduce<ClosedTradeRecord | null>((best, trade) => {
    if (!best || trade.netOutcomeSol > best.netOutcomeSol) return trade;
    return best;
  }, null);
  if (largestGain && largestGain.netOutcomeSol > EPSILON) {
    keyEvents.push({
      type: "largest_gain",
      timestamp: largestGain.exitTime,
      token: largestGain.symbol,
      signature: largestGain.exitSignature,
      tradeContext: `Closed ${round(largestGain.tokenAmount, 4)} ${largestGain.symbol} for ${formatSignedSol(largestGain.netOutcomeSol)} after ${formatHoldDuration(largestGain.holdingDurationSec)}.`,
      interpretation: "Biggest win of the window, captured when momentum finally paid rent.",
    });
  }

  const largestLoss = sortedClosed.reduce<ClosedTradeRecord | null>((worst, trade) => {
    if (!worst || trade.netOutcomeSol < worst.netOutcomeSol) return trade;
    return worst;
  }, null);
  if (largestLoss && largestLoss.netOutcomeSol < -EPSILON) {
    keyEvents.push({
      type: "largest_loss",
      timestamp: largestLoss.exitTime,
      token: largestLoss.symbol,
      signature: largestLoss.exitSignature,
      tradeContext: `Closed ${round(largestLoss.tokenAmount, 4)} ${largestLoss.symbol} for ${formatSignedSol(largestLoss.netOutcomeSol)} after ${formatHoldDuration(largestLoss.holdingDurationSec)}.`,
      interpretation: "Largest drawdown moment, where the chart stopped cooperating.",
    });
  }

  const panicExit = sortedClosed
    .filter(
      (trade) =>
        trade.netOutcomeSol < -EPSILON && trade.holdingDurationSec <= 5 * 60,
    )
    .sort((a, b) => a.netOutcomeSol - b.netOutcomeSol)[0];
  if (panicExit) {
    keyEvents.push({
      type: "panic_exit",
      timestamp: panicExit.exitTime,
      token: panicExit.symbol,
      signature: panicExit.exitSignature,
      tradeContext: `Exited ${panicExit.symbol} in ${formatHoldDuration(panicExit.holdingDurationSec)} for ${formatSignedSol(panicExit.netOutcomeSol)}.`,
      interpretation: "Fast risk-off decision that looked like pure survival mode.",
    });
  }

  let bestReversal: { previous: ClosedTradeRecord; current: ClosedTradeRecord } | null =
    null;
  let bestReversalScore = 0;
  for (let index = 1; index < sortedClosed.length; index += 1) {
    const previous = sortedClosed[index - 1]!;
    const current = sortedClosed[index]!;
    const gap = current.entryTime - previous.exitTime;
    if (gap < 0 || gap > 20 * 60) continue;
    if (previous.netOutcomeSol >= 0 || current.netOutcomeSol <= 0) continue;

    const score = Math.abs(previous.netOutcomeSol) + current.netOutcomeSol;
    if (score > bestReversalScore) {
      bestReversalScore = score;
      bestReversal = { previous, current };
    }
  }
  if (bestReversal) {
    keyEvents.push({
      type: "rapid_reversal",
      timestamp: bestReversal.current.exitTime,
      token: `${bestReversal.previous.symbol} -> ${bestReversal.current.symbol}`,
      signature: bestReversal.current.exitSignature,
      tradeContext: `Switched from ${bestReversal.previous.symbol} (${formatSignedSol(bestReversal.previous.netOutcomeSol)}) to ${bestReversal.current.symbol} (${formatSignedSol(bestReversal.current.netOutcomeSol)}) within 20 minutes.`,
      interpretation: "Quick direction change that flipped the emotional script.",
    });
  }

  const firstLosingTrade = sortedClosed.find((trade) => trade.netOutcomeSol < -EPSILON);
  if (firstLosingTrade) {
    const revengeBuy = trades.find(
      (trade) =>
        trade.side === "buy" &&
        trade.timestamp > firstLosingTrade.exitTime &&
        trade.timestamp <= firstLosingTrade.exitTime + 15 * 60,
    );

    if (revengeBuy) {
      keyEvents.push({
        type: "revenge_trade",
        timestamp: revengeBuy.timestamp,
        token: revengeBuy.symbol,
        signature: revengeBuy.signature,
        tradeContext: `Re-entered with ${round(revengeBuy.solAmount)} SOL on ${revengeBuy.symbol} shortly after a ${formatSignedSol(firstLosingTrade.netOutcomeSol)} loss.`,
        interpretation: "Classic 'run it back' moment immediately after taking damage.",
      });
    }
  }

  return keyEvents.sort((a, b) => a.timestamp - b.timestamp).slice(0, 6);
}

function buildMemorableMoments(keyEvents: WalletKeyEvent[]): string[] {
  if (!keyEvents.length) {
    return ["No standout closed-trade event was detected in this window."];
  }
  return keyEvents.slice(0, 4).map(
    (event) => `${event.tradeContext} ${event.interpretation}`,
  );
}

function buildFunObservations(input: {
  metrics: WalletBehavioralMetrics;
  personality: string;
  estimatedPnlSol: number;
}): string[] {
  if (input.metrics.totalTrades === 0) {
    return ["No Pump trades were available to profile this wallet yet."];
  }

  const observations: string[] = [];
  const { metrics, personality, estimatedPnlSol } = input;

  observations.push(
    `This wallet ran ${metrics.totalTrades} trades and fully committed to the ${personality} arc.`,
  );

  if (metrics.rapidFlipRatio >= 0.35) {
    observations.push("The sell button got more cardio than most gym memberships.");
  }

  if (metrics.postLossReentryCount >= 2) {
    observations.push(
      "After losses, the strategy often became: immediate sequel, no cooldown.",
    );
  }

  if (metrics.nightTradeRatio >= 0.45) {
    observations.push(
      "Most action happened while normal sleep schedules were offline.",
    );
  }

  if (estimatedPnlSol >= 0) {
    observations.push("Despite chaos, the wallet found a way to keep more SOL.");
  } else {
    observations.push("PnL took hits, but the storytelling value stayed premium.");
  }

  return observations.slice(0, 5);
}

function buildNarrativeSummary(input: {
  rangeDays: number;
  metrics: WalletBehavioralMetrics;
  pumpTokensTraded: number;
  estimatedPnlSol: number;
  primaryPersonality: string;
  secondaryPersonality: string | null;
  modifiers: string[];
  keyEvents: WalletKeyEvent[];
}): string {
  if (input.metrics.totalTrades === 0) {
    return (
      `No Pump trades were detected in the last ${input.rangeDays} day(s), so the engine has no behavioral signal to classify yet. ` +
      "Run again after fresh Pump activity for a full personality read."
    );
  }

  const pnlText = formatSignedSol(input.estimatedPnlSol);
  const modifiersText = input.modifiers.slice(0, 3).join(", ");
  const event = input.keyEvents[input.keyEvents.length - 1];
  const secondaryText = input.secondaryPersonality
    ? ` with a secondary ${input.secondaryPersonality} streak`
    : "";

  const eventSentence = event
    ? `Key moment: ${event.tradeContext}`
    : "No single event dominated, so behavior patterns carried the story.";

  return (
    `Over ${input.rangeDays} day(s), this wallet traded ${input.metrics.totalTrades} times across ` +
    `${input.pumpTokensTraded} Pump tokens (${input.metrics.buyCount} buys / ${input.metrics.sellCount} sells), ` +
    `finishing at ${pnlText}. The dominant archetype is ${input.primaryPersonality}${secondaryText}. ` +
    `Behavior leaned on ${modifiersText}. ${eventSentence}`
  );
}

function buildStoryBeats(input: {
  metrics: WalletBehavioralMetrics;
  primaryPersonality: string;
  keyEvents: WalletKeyEvent[];
  estimatedPnlSol: number;
  openPositionCount: number;
}): string[] {
  if (input.metrics.totalTrades === 0) {
    return [
      "Entry phase: no qualifying Pump trades in the selected window.",
      "Conflict phase: insufficient activity to establish behavioral tension.",
      "Turning point: waiting for the next on-chain Pump decision.",
      "Resolution: rerun after new activity for a full cinematic arc.",
    ];
  }

  const lossEvent = input.keyEvents.find((event) => event.type === "largest_loss");
  const gainEvent = input.keyEvents.find((event) => event.type === "largest_gain");
  const reversalEvent = input.keyEvents.find(
    (event) => event.type === "rapid_reversal",
  );

  const entryBeat =
    `Entry phase: ${input.primaryPersonality} opens with ${input.metrics.tradesPerDay} trades/day pace ` +
    `and ${input.metrics.buyCount} buy attempts.`;
  const conflictBeat = lossEvent
    ? `Conflict phase: ${lossEvent.tradeContext}`
    : "Conflict phase: momentum whipsaws force frequent decision resets.";
  const turningPointBeat = reversalEvent
    ? `Turning point: ${reversalEvent.tradeContext}`
    : gainEvent
      ? `Turning point: ${gainEvent.tradeContext}`
      : "Turning point: position management shifts from reaction to control.";
  const resolutionBeat =
    `Resolution: closes at ${formatSignedSol(input.estimatedPnlSol)} with ${input.openPositionCount} open position(s) still on the board.`;

  return [entryBeat, conflictBeat, turningPointBeat, resolutionBeat];
}

function formatBestTrade(closedTrades: ClosedTradeRecord[], trades: PumpTrade[]): string {
  if (closedTrades.length) {
    const best = closedTrades.reduce((currentBest, trade) =>
      trade.netOutcomeSol > currentBest.netOutcomeSol ? trade : currentBest,
    );
    return `${best.symbol} (${formatSignedSol(best.netOutcomeSol)})`;
  }

  const directional = trades.map((trade) => ({
    ...trade,
    signedSol: trade.side === "sell" ? trade.solAmount : -trade.solAmount,
  }));
  const bestDirectional = directional.reduce(
    (best, current) => (current.signedSol > best.signedSol ? current : best),
    directional[0] ?? null,
  );

  return bestDirectional
    ? `${bestDirectional.symbol} (${formatSignedSol(bestDirectional.signedSol)})`
    : "N/A";
}

function formatWorstTrade(closedTrades: ClosedTradeRecord[], trades: PumpTrade[]): string {
  if (closedTrades.length) {
    const worst = closedTrades.reduce((currentWorst, trade) =>
      trade.netOutcomeSol < currentWorst.netOutcomeSol ? trade : currentWorst,
    );
    return `${worst.symbol} (${formatSignedSol(worst.netOutcomeSol)})`;
  }

  const directional = trades.map((trade) => ({
    ...trade,
    signedSol: trade.side === "sell" ? trade.solAmount : -trade.solAmount,
  }));
  const worstDirectional = directional.reduce(
    (worst, current) => (current.signedSol < worst.signedSol ? current : worst),
    directional[0] ?? null,
  );

  return worstDirectional
    ? `${worstDirectional.symbol} (${formatSignedSol(worstDirectional.signedSol)})`
    : "N/A";
}

export function computeAnalyticsFromTrades(input: {
  jobId: string;
  wallet: string;
  rangeDays: number;
  packageType: WalletStory["packageType"];
  durationSeconds: number;
  trades: PumpTrade[];
}): ComputedAnalytics {
  const trades = [...input.trades].sort((a, b) => a.timestamp - b.timestamp);
  const buyTrades = trades.filter((trade) => trade.side === "buy");
  const sellTrades = trades.filter((trade) => trade.side === "sell");

  const solSpent = buyTrades.reduce((sum, trade) => sum + trade.solAmount, 0);
  const solReceived = sellTrades.reduce((sum, trade) => sum + trade.solAmount, 0);
  const estimatedPnlSol = solReceived - solSpent;
  const pumpTokensTraded = new Set(trades.map((trade) => trade.mint)).size;

  const { closedTrades, openPositions } = normalizeTrades(trades);
  const behavior = computeBehaviorMetrics({
    trades,
    closedTrades,
    openPositions,
    rangeDays: input.rangeDays,
  });
  const patterns = detectBehaviorPatterns({
    metrics: behavior.metrics,
    details: behavior.details,
  });
  const styleClassification = classifyTradingStyle(behavior.metrics, patterns);
  const personality = assignWalletPersonality({
    patterns,
    metrics: behavior.metrics,
    estimatedPnlSol,
  });
  const modifiers = deriveModifiers({
    metrics: behavior.metrics,
    patterns,
  });
  const keyEvents = extractKeyEvents({
    closedTrades,
    trades,
  });
  const behavioralSummary = buildBehavioralSummary(patterns, behavior.metrics);
  const narrativeSummary = buildNarrativeSummary({
    rangeDays: input.rangeDays,
    metrics: behavior.metrics,
    pumpTokensTraded,
    estimatedPnlSol,
    primaryPersonality: personality.primary,
    secondaryPersonality: personality.secondary,
    modifiers,
    keyEvents,
  });
  const storyBeats = buildStoryBeats({
    metrics: behavior.metrics,
    primaryPersonality: personality.primary,
    keyEvents,
    estimatedPnlSol,
    openPositionCount: openPositions.length,
  });
  const memorableMoments = buildMemorableMoments(keyEvents);
  const funObservations = buildFunObservations({
    metrics: behavior.metrics,
    personality: personality.primary,
    estimatedPnlSol,
  });
  const timeline = buildTimeline(trades);

  const walletProfile: WalletProfile = {
    personality: personality.primary,
    secondaryPersonality: personality.secondary,
    modifiers,
    behavioralSummary,
    keyEvents,
    tradingStyle: styleClassification,
    narrativeSummary,
    storyBeats,
    metrics: behavior.metrics,
  };

  const bestTrade = formatBestTrade(closedTrades, trades);
  const worstTrade = formatWorstTrade(closedTrades, trades);

  const report = {
    jobId: input.jobId,
    wallet: input.wallet,
    rangeDays: input.rangeDays,
    pumpTokensTraded,
    buyCount: buyTrades.length,
    sellCount: sellTrades.length,
    solSpent: round(solSpent),
    solReceived: round(solReceived),
    estimatedPnlSol: round(estimatedPnlSol),
    bestTrade,
    worstTrade,
    styleClassification,
    timeline,
    walletPersonality: walletProfile.personality,
    walletSecondaryPersonality: walletProfile.secondaryPersonality,
    walletModifiers: walletProfile.modifiers,
    behaviorPatterns: walletProfile.behavioralSummary,
    memorableMoments,
    funObservations,
    narrativeSummary: walletProfile.narrativeSummary,
    storyBeats: walletProfile.storyBeats,
    keyEvents: walletProfile.keyEvents,
    walletProfile,
  };

  return {
    report,
    story: {
      wallet: input.wallet,
      rangeDays: input.rangeDays,
      packageType: input.packageType,
      durationSeconds: input.durationSeconds,
      analytics: {
        pumpTokensTraded,
        buyCount: buyTrades.length,
        sellCount: sellTrades.length,
        solSpent: report.solSpent,
        solReceived: report.solReceived,
        estimatedPnlSol: report.estimatedPnlSol,
        bestTrade,
        worstTrade,
        styleClassification,
      },
      timeline,
      walletPersonality: walletProfile.personality,
      walletSecondaryPersonality: walletProfile.secondaryPersonality,
      walletModifiers: walletProfile.modifiers,
      behaviorPatterns: walletProfile.behavioralSummary,
      memorableMoments,
      funObservations,
      narrativeSummary: walletProfile.narrativeSummary,
      storyBeats: walletProfile.storyBeats,
      keyEvents: walletProfile.keyEvents,
      walletProfile,
    },
  };
}
