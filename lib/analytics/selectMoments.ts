import { round } from "@/lib/utils";
import { NormalizedTrade, WalletMetrics, WalletMoment, WalletMoments } from "./types";

interface MomentCandidate {
  key: keyof WalletMoments;
  score: number;
  moment: WalletMoment;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function tradeHour(timestamp: number): number {
  return new Date(timestamp * 1000).getUTCHours();
}

function isNight(timestamp: number): boolean {
  const hour = tradeHour(timestamp);
  return hour >= 0 && hour < 6;
}

function confidence(score: number): number {
  return round(clamp(score), 3);
}

function createMoment(input: {
  title: string;
  description: string;
  explanation: string;
  humorLine: string;
  tradeSignatures?: string[];
  confidence: number;
}): WalletMoment {
  return {
    title: input.title,
    description: input.description,
    tradeSignatures: input.tradeSignatures,
    explanation: input.explanation,
    humorLine: input.humorLine,
    confidence: confidence(input.confidence),
  };
}

function getSells(trades: NormalizedTrade[]): NormalizedTrade[] {
  return trades.filter(
    (trade) => trade.side === "SELL" && typeof trade.pnlSol === "number",
  );
}

function computeOvercookedCandidate(trades: NormalizedTrade[]): MomentCandidate | null {
  if (trades.length < 4) return null;

  let bestCount = 0;
  let bestWindowStart = 0;
  for (let i = 0; i < trades.length; i += 1) {
    const start = trades[i]!.timestamp;
    const end = start + 60 * 60;
    const count = trades.filter((trade) => trade.timestamp >= start && trade.timestamp <= end).length;
    if (count > bestCount) {
      bestCount = count;
      bestWindowStart = start;
    }
  }

  if (bestCount < 4) return null;

  const windowTrades = trades.filter(
    (trade) => trade.timestamp >= bestWindowStart && trade.timestamp <= bestWindowStart + 60 * 60,
  );

  const score = clamp((bestCount - 3) / 6);
  return {
    key: "overcookedMoment",
    score,
    moment: createMoment({
      title: "Overcooked Moment",
      description: `Executed ${bestCount} trades inside one hour and cooked the setup past medium rare.`,
      explanation:
        "High trade density in a short window suggests over-management and emotional micromanaging.",
      humorLine: "You did too much. Even the chart asked for a timeout.",
      tradeSignatures: windowTrades.map((trade) => trade.signature),
      confidence: score,
    }),
  };
}

function computeMainCharacterCandidate(sells: NormalizedTrade[]): MomentCandidate | null {
  const best = sells.reduce<NormalizedTrade | null>((current, trade) => {
    if (!current) return trade;
    return (trade.pnlSol ?? 0) > (current.pnlSol ?? 0) ? trade : current;
  }, null);

  if (!best || (best.pnlSol ?? 0) <= 0) {
    return null;
  }

  const score = clamp(Math.abs(best.pnlSol ?? 0) / Math.max(0.3, best.solAmount * 0.8));
  return {
    key: "mainCharacterMoment",
    score,
    moment: createMoment({
      title: "Main Character Moment",
      description: `${best.symbol ?? "Token"} closed for ${round(best.pnlSol ?? 0, 4)} SOL and shifted the vibe.`,
      explanation:
        "Largest realized winning exit in the window, representing the strongest competent outcome.",
      humorLine: "For one scene, the wallet remembered how to cook.",
      tradeSignatures: [best.signature],
      confidence: score,
    }),
  };
}

function computeFumbleCandidate(sells: NormalizedTrade[]): MomentCandidate | null {
  const worst = sells.reduce<NormalizedTrade | null>((current, trade) => {
    if (!current) return trade;
    return (trade.pnlSol ?? 0) < (current.pnlSol ?? 0) ? trade : current;
  }, null);

  if (!worst || (worst.pnlSol ?? 0) >= 0) {
    return null;
  }

  const score = clamp(Math.abs(worst.pnlSol ?? 0) / Math.max(0.2, worst.solAmount));
  return {
    key: "fumbleMoment",
    score,
    moment: createMoment({
      title: "Fumble Moment",
      description: `${worst.symbol ?? "Token"} realized ${round(worst.pnlSol ?? 0, 4)} SOL and left a crater.`,
      explanation: "Largest realized loss in the window and the clearest bag fumble.",
      humorLine: "The bag slipped out of your hands and filed a police report.",
      tradeSignatures: [worst.signature],
      confidence: score,
    }),
  };
}

function computePaperHandsCandidate(
  trades: NormalizedTrade[],
  sells: NormalizedTrade[],
): MomentCandidate | null {
  const candidates = sells.filter(
    (trade) =>
      (trade.pnlSol ?? 0) > 0 &&
      (trade.holdDurationMinutes ?? Number.POSITIVE_INFINITY) <= 25,
  );

  let best: { trade: NormalizedTrade; score: number; laterEvidence: NormalizedTrade | null } | null = null;

  for (const trade of candidates) {
    const laterSameToken = trades.find(
      (candidate) =>
        candidate.mint === trade.mint &&
        candidate.timestamp > trade.timestamp &&
        candidate.timestamp <= trade.timestamp + 6 * 60 * 60 &&
        (candidate.priceEstimate ?? 0) > (trade.priceEstimate ?? 0) * 1.25,
    );

    if (!laterSameToken) continue;

    const score = clamp(
      ((trade.pnlSol ?? 0) / Math.max(0.1, trade.solAmount)) * 0.5 +
        (1 - Math.min((trade.holdDurationMinutes ?? 0) / 25, 1)) * 0.5,
    );

    if (!best || score > best.score) {
      best = { trade, score, laterEvidence: laterSameToken };
    }
  }

  if (!best) return null;

  return {
    key: "paperHandsMoment",
    score: best.score,
    moment: createMoment({
      title: "Paper Hands Moment",
      description: `Locked a quick win on ${best.trade.symbol ?? "token"} and watched later price action run hotter.`,
      explanation:
        "Fast profitable exit followed by higher same-token prices indicates premature profit taking.",
      humorLine: "You took lunch money and missed the inheritance.",
      tradeSignatures: [best.trade.signature, best.laterEvidence?.signature ?? ""].filter(Boolean),
      confidence: best.score,
    }),
  };
}

function computeDiamondHandsCandidate(
  trades: NormalizedTrade[],
  sells: NormalizedTrade[],
): MomentCandidate | null {
  const longestClosed = sells
    .filter((trade) => (trade.holdDurationMinutes ?? 0) > 0)
    .sort((a, b) => (b.holdDurationMinutes ?? 0) - (a.holdDurationMinutes ?? 0))[0];

  const openOldest = trades
    .filter((trade) => trade.side === "BUY" && trade.isOpenPosition)
    .sort((a, b) => a.timestamp - b.timestamp)[0];

  if (!longestClosed && !openOldest) {
    return null;
  }

  const holdMinutes = longestClosed?.holdDurationMinutes ??
    (openOldest ? (trades[trades.length - 1]!.timestamp - openOldest.timestamp) / 60 : 0);
  const score = clamp((holdMinutes ?? 0) / 240);

  return {
    key: "diamondHandsMoment",
    score,
    moment: createMoment({
      title: "Diamond Hands Moment",
      description:
        longestClosed
          ? `${longestClosed.symbol ?? "Token"} was held for ${round(
              longestClosed.holdDurationMinutes ?? 0,
              1,
            )} minutes before exit.`
          : `${openOldest?.symbol ?? "Token"} is still being held despite chaos in the window.`,
      explanation:
        "Longest hold in the sample, showing willingness to sit through volatility.",
      humorLine: "Hands were either diamond or spiritually unavailable.",
      tradeSignatures: [longestClosed?.signature ?? openOldest?.signature ?? ""].filter(Boolean),
      confidence: score,
    }),
  };
}

function computeComebackCandidate(sells: NormalizedTrade[]): MomentCandidate | null {
  let best: { losing: NormalizedTrade; winning: NormalizedTrade; score: number } | null = null;

  for (let i = 0; i < sells.length; i += 1) {
    const losing = sells[i]!;
    if ((losing.pnlSol ?? 0) >= 0) continue;

    for (let j = i + 1; j < sells.length; j += 1) {
      const winning = sells[j]!;
      if ((winning.pnlSol ?? 0) <= 0) continue;
      if (winning.timestamp - losing.timestamp > 6 * 60 * 60) break;

      const score = clamp(
        ((winning.pnlSol ?? 0) + Math.abs(losing.pnlSol ?? 0)) /
          Math.max(0.2, losing.solAmount + winning.solAmount),
      );

      if (!best || score > best.score) {
        best = { losing, winning, score };
      }
    }
  }

  if (!best) return null;

  return {
    key: "comebackMoment",
    score: best.score,
    moment: createMoment({
      title: "Comeback Moment",
      description: `After a ${round(best.losing.pnlSol ?? 0, 4)} SOL hit, ${best.winning.symbol ?? "token"} bounced back with ${round(best.winning.pnlSol ?? 0, 4)} SOL.`,
      explanation:
        "A loss followed by a strong win in a short sequence materially changed the arc.",
      humorLine: "You got clipped, glitched, then reappeared with plot armor.",
      tradeSignatures: [best.losing.signature, best.winning.signature],
      confidence: best.score,
    }),
  };
}

function computeGoblinHourCandidate(trades: NormalizedTrade[]): MomentCandidate | null {
  const nightTrades = trades.filter((trade) => isNight(trade.timestamp));
  if (!nightTrades.length) return null;

  const worstNight = nightTrades.sort((a, b) => {
    const aSwing = Math.max(Math.abs(a.pnlSol ?? 0), a.solAmount);
    const bSwing = Math.max(Math.abs(b.pnlSol ?? 0), b.solAmount);
    return bSwing - aSwing;
  })[0]!;

  const score = clamp(
    Math.max(Math.abs(worstNight.pnlSol ?? 0), worstNight.solAmount) /
      Math.max(0.3, worstNight.solAmount * 1.3),
  );

  return {
    key: "goblinHourMoment",
    score,
    moment: createMoment({
      title: "Goblin Hour Moment",
      description: `${worstNight.symbol ?? "Token"} got traded at ${tradeHour(worstNight.timestamp)}:00 UTC with full spiritual confidence.`,
      explanation: "Highest-impact night-session trade in the selected window.",
      humorLine: "This was posted by insomnia, not strategy.",
      tradeSignatures: [worstNight.signature],
      confidence: score,
    }),
  };
}

function computeConvictionCandidate(trades: NormalizedTrade[]): MomentCandidate | null {
  const buyTrades = trades.filter((trade) => trade.side === "BUY");
  if (!buyTrades.length) return null;

  const buyCounts = new Map<string, number>();
  for (const trade of buyTrades) {
    buyCounts.set(trade.mint, (buyCounts.get(trade.mint) ?? 0) + 1);
  }

  const topMint = [...buyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!topMint) return null;

  const [mint, count] = topMint;
  const mintTrades = trades.filter((trade) => trade.mint === mint);
  const tokenName = mintTrades[0]?.symbol ?? "Token";
  const score = clamp(count / Math.max(2, buyTrades.length * 0.5));

  return {
    key: "convictionMoment",
    score,
    moment: createMoment({
      title: "Conviction Moment",
      description: `${tokenName} got ${count} separate buy commitments in this window.`,
      explanation:
        "Repeated entries into the same token indicate thesis commitment rather than random spray behavior.",
      humorLine: "You did not date this token. You moved in emotionally.",
      tradeSignatures: mintTrades.map((trade) => trade.signature),
      confidence: score,
    }),
  };
}

function computeHadToBeThereCandidate(trades: NormalizedTrade[]): MomentCandidate | null {
  if (trades.length < 3) return null;

  let best: { sequence: NormalizedTrade[]; score: number } | null = null;
  for (let i = 0; i < trades.length - 2; i += 1) {
    const base = trades[i]!;
    const seq = trades.filter(
      (trade) =>
        trade.mint === base.mint &&
        trade.timestamp >= base.timestamp &&
        trade.timestamp <= base.timestamp + 45 * 60,
    );

    const sideMix = new Set(seq.map((trade) => trade.side)).size;
    if (seq.length < 3 || sideMix < 2) continue;

    const score = clamp(seq.length / 6 + sideMix * 0.15);
    if (!best || score > best.score) {
      best = { sequence: seq, score };
    }
  }

  if (!best) return null;

  const token = best.sequence[0]?.symbol ?? "token";
  return {
    key: "hadToBeThereMoment",
    score: best.score,
    moment: createMoment({
      title: "Had-To-Be-There Moment",
      description: `${token} had ${best.sequence.length} back-to-back actions in under 45 minutes and none of them looked normal.`,
      explanation:
        "Fast mixed-side sequence on one token creates highly context-dependent trench lore.",
      humorLine: "Impossible to explain cleanly. Everyone in the village still remembers it.",
      tradeSignatures: best.sequence.map((trade) => trade.signature),
      confidence: best.score,
    }),
  };
}

function computeEscapeCandidate(trades: NormalizedTrade[]): MomentCandidate | null {
  const sells = getSells(trades).filter((trade) => (trade.pnlSol ?? 0) >= 0);

  let best: { escapeSell: NormalizedTrade; laterDamage: NormalizedTrade; score: number } | null = null;
  for (const sell of sells) {
    const laterLoss = trades.find(
      (trade) =>
        trade.mint === sell.mint &&
        trade.timestamp > sell.timestamp &&
        trade.timestamp <= sell.timestamp + 6 * 60 * 60 &&
        trade.side === "SELL" &&
        (trade.pnlSol ?? 0) < 0,
    );

    if (!laterLoss) continue;

    const score = clamp(Math.abs(laterLoss.pnlSol ?? 0) / Math.max(0.2, sell.solAmount));
    if (!best || score > best.score) {
      best = { escapeSell: sell, laterDamage: laterLoss, score };
    }
  }

  if (!best) return null;

  return {
    key: "escapeMoment",
    score: best.score,
    moment: createMoment({
      title: "Escape Moment",
      description: `Exited ${best.escapeSell.symbol ?? "token"} before a later sequence printed ${round(best.laterDamage.pnlSol ?? 0, 4)} SOL pain.`,
      explanation:
        "A profitable or flat exit occurred before a later same-token losing realization, indicating narrow avoidance.",
      humorLine: "You left right before the floor gave a TED Talk.",
      tradeSignatures: [best.escapeSell.signature, best.laterDamage.signature],
      confidence: best.score,
    }),
  };
}

function computeTrenchLoreCandidate(
  trades: NormalizedTrade[],
): MomentCandidate | null {
  const oddTrade = [...trades]
    .filter((trade) => isNight(trade.timestamp) || (trade.holdDurationMinutes ?? 0) <= 5)
    .sort(
      (a, b) => Math.max(Math.abs(b.pnlSol ?? 0), b.solAmount) - Math.max(Math.abs(a.pnlSol ?? 0), a.solAmount),
    )[0];

  if (!oddTrade) return null;

  const score = clamp(
    (isNight(oddTrade.timestamp) ? 0.4 : 0.2) +
      ((oddTrade.holdDurationMinutes ?? 999) <= 5 ? 0.3 : 0.1) +
      clamp(Math.max(Math.abs(oddTrade.pnlSol ?? 0), oddTrade.solAmount) / Math.max(0.3, oddTrade.solAmount * 1.2)) *
        0.3,
  );

  return {
    key: "trenchLoreMoment",
    score,
    moment: createMoment({
      title: "Trench Lore Moment",
      description: `${oddTrade.symbol ?? "Token"} produced a trade sequence that only makes sense to people who were there live.`,
      explanation: "Most context-heavy and culturally weird event in the selected window.",
      humorLine: "You had to be in the trenches chat to process this one.",
      tradeSignatures: [oddTrade.signature],
      confidence: score,
    }),
  };
}

function computeAbsoluteCinemaCandidate(candidates: MomentCandidate[]): MomentCandidate | null {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return null;

  const score = clamp(best.score * 1.05);
  return {
    key: "absoluteCinemaMoment",
    score,
    moment: createMoment({
      title: "Absolute Cinema Moment",
      description: best.moment.description,
      explanation: `Highest cinematic weight across all detected moments (${best.key}).`,
      humorLine: "Brother this was cinema.",
      tradeSignatures: best.moment.tradeSignatures,
      confidence: score,
    }),
  };
}

export function selectMoments(input: {
  normalizedTrades: NormalizedTrade[];
  metrics: WalletMetrics;
}): WalletMoments {
  const trades = [...input.normalizedTrades].sort((a, b) => a.timestamp - b.timestamp);
  const sells = getSells(trades);

  const candidates: Array<MomentCandidate | null> = [
    computeMainCharacterCandidate(sells),
    computeTrenchLoreCandidate(trades),
    computePaperHandsCandidate(trades, sells),
    computeDiamondHandsCandidate(trades, sells),
    computeComebackCandidate(sells),
    computeFumbleCandidate(sells),
    computeGoblinHourCandidate(trades),
    computeConvictionCandidate(trades),
    computeHadToBeThereCandidate(trades),
    computeEscapeCandidate(trades),
    computeOvercookedCandidate(trades),
  ];

  // Facts-first: moments are only selected from computed, factual trade behavior.
  // Confidence floor prevents filler moments from being emitted.
  const relevanceFloor = input.metrics.virality.cinemaScore >= 0.7 ? 0.38 : 0.45;

  const relevant = candidates
    .filter((candidate): candidate is MomentCandidate => Boolean(candidate))
    .filter((candidate) => candidate.score >= relevanceFloor);

  const absoluteCinema = computeAbsoluteCinemaCandidate(relevant);

  const moments: WalletMoments = {};
  for (const candidate of relevant) {
    moments[candidate.key] = candidate.moment;
  }
  if (absoluteCinema && absoluteCinema.score >= relevanceFloor) {
    moments.absoluteCinemaMoment = absoluteCinema.moment;
  }

  return moments;
}
