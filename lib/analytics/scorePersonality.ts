import { round } from "@/lib/utils";
import {
  BEHAVIOR_SIGNAL_LABELS,
  PERSONALITY_DEFINITIONS,
} from "./constants";
import {
  BehaviorSignalMap,
  PersonalityDefinition,
  PersonalityProfileResult,
  WalletMetrics,
} from "./types";

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function deriveBehaviorSignals(metrics: WalletMetrics): BehaviorSignalMap {
  // Signal pack compresses grouped metrics into reusable behavioral features.
  // These are shared across personality and modifier scoring matrices.
  const avgHoldNorm = clamp(metrics.holding.avgHoldMinutes / 180);
  const tradeFrequencyNorm = clamp(metrics.activity.tradesPerHour / 2.2);
  const sizeVolatilityNorm = clamp(metrics.sizing.sizeVariance / 1.5);
  const chaos = clamp(metrics.behavior.chaosScore);
  const consistency = clamp(1 - chaos);

  const luckSkew = clamp(
    metrics.pnl.realizedWinRate * 0.55 +
      chaos * 0.2 +
      Math.max(0, metrics.pnl.estimatedPnlSol) / Math.max(0.5, metrics.sizing.avgSolPerTrade * 3) *
        0.25,
  );

  const comebackPotential = clamp(
    (metrics.pnl.estimatedPnlSol > 0 && metrics.pnl.biggestLoss < 0 ? 0.6 : 0.25) +
      metrics.behavior.revengeBias * 0.2 +
      (Math.abs(metrics.pnl.biggestLoss) > Math.abs(metrics.pnl.biggestWin) ? 0.2 : 0),
  );

  return {
    earlyEntryBehavior: clamp(metrics.timing.earlyEntryBias),
    lateEntryBehavior: clamp(metrics.timing.lateEntryBias),
    rapidReentryAfterLosses: clamp(metrics.timing.rapidReentryScore),
    averageHoldDuration: avgHoldNorm,
    sizeVolatility: sizeVolatilityNorm,
    tradeFrequency: tradeFrequencyNorm,
    smallWinsTooFast: clamp(metrics.holding.shortHoldBias),
    holdLosers: clamp((metrics.holding.bagholdBias + metrics.risk.drawdownTolerance) / 2),
    behaviorAfterDrawdowns: clamp((metrics.risk.drawdownTolerance + metrics.behavior.revengeBias) / 2),
    chasingAttention: clamp(metrics.attention.chaseScore),
    concentrationBehavior: clamp(metrics.sizing.concentrationScore),
    sprayBehavior: clamp(1 - metrics.sizing.concentrationScore),
    consistencyBehavior: consistency,
    chaosBehavior: chaos,
    patienceBehavior: clamp(metrics.behavior.patienceScore),
    convictionBehavior: clamp(metrics.behavior.convictionScore),
    momentumAddiction: clamp(
      metrics.attention.chaseScore * 0.55 + metrics.timing.lateEntryBias * 0.45,
    ),
    metaAwareness: clamp(metrics.attention.momentumAlignment),
    comebackPotential,
    luckSkew,
  };
}

function explainScore(
  definition: PersonalityDefinition,
  signals: BehaviorSignalMap,
): string {
  const contributions = Object.entries(definition.signalWeights)
    .map(([signal, weight]) => {
      const signalKey = signal as keyof BehaviorSignalMap;
      const signalValue = signals[signalKey] ?? 0;
      const contribution = signalValue * (weight ?? 0);
      return {
        signalKey,
        signalValue,
        contribution,
      };
    })
    .filter((entry) => entry.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map(
      (entry) =>
        `${BEHAVIOR_SIGNAL_LABELS[entry.signalKey]} (${round(entry.signalValue * 100, 1)}%)`,
    );

  if (!contributions.length) {
    return "Classification came from residual low-signal behavior patterns.";
  }

  return `Top contributors: ${contributions.join(", ")}.
${definition.scoringLogicNotes}`;
}

function scoreDefinition(
  definition: PersonalityDefinition,
  signals: BehaviorSignalMap,
): number {
  // Composable weighted scoring matrix:
  // each personality accumulates weighted contributions from many signal families.
  const raw = Object.entries(definition.signalWeights).reduce((sum, [signal, weight]) => {
    const signalKey = signal as keyof BehaviorSignalMap;
    return sum + (weight ?? 0) * (signals[signalKey] ?? 0);
  }, 0);

  const maxPositive = Object.values(definition.signalWeights).reduce(
    (sum, weight) => sum + Math.max(0, weight ?? 0),
    0,
  );

  if (maxPositive <= 0) {
    return 0;
  }

  return clamp(raw / maxPositive) * 100;
}

export function scorePersonality(input: {
  metrics: WalletMetrics;
}): PersonalityProfileResult {
  const { metrics } = input;

  if (metrics.activity.tradeCount <= 0) {
    return {
      primary: {
        id: "casino-tourist",
        displayName: "The Casino Tourist",
        score: 0,
        explanation:
          "No Pump.fun trades were detected in this window, so personality confidence is intentionally low.",
      },
      secondaryCandidates: [],
    };
  }

  const signals = deriveBehaviorSignals(metrics);
  const ranked = PERSONALITY_DEFINITIONS.map((definition) => ({
    definition,
    score: round(scoreDefinition(definition, signals), 2),
  })).sort((a, b) => b.score - a.score);

  const primary = ranked[0] ?? {
    definition: PERSONALITY_DEFINITIONS[0]!,
    score: 0,
  };

  return {
    primary: {
      id: primary.definition.id,
      displayName: primary.definition.displayName,
      score: primary.score,
      explanation: explainScore(primary.definition, signals),
    },
    secondaryCandidates: ranked.slice(1, 5).map((entry) => ({
      id: entry.definition.id,
      displayName: entry.definition.displayName,
      score: entry.score,
    })),
  };
}
