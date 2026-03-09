import { round } from "@/lib/utils";
import { BEHAVIOR_SIGNAL_LABELS, MODIFIER_DEFINITIONS } from "./constants";
import { deriveBehaviorSignals } from "./scorePersonality";
import { ModifierDefinition, ModifierResult, WalletMetrics } from "./types";

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function scoreDefinition(definition: ModifierDefinition, signals: Record<string, number>): number {
  const raw = Object.entries(definition.signalWeights).reduce((sum, [signal, weight]) => {
    return sum + (weight ?? 0) * (signals[signal] ?? 0);
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

function explainModifier(
  definition: ModifierDefinition,
  signals: Record<string, number>,
): string {
  const topDrivers = Object.entries(definition.signalWeights)
    .map(([signal, weight]) => {
      const value = signals[signal] ?? 0;
      return {
        signal,
        contribution: value * (weight ?? 0),
        value,
      };
    })
    .filter((driver) => driver.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2)
    .map((driver) => {
      const label = BEHAVIOR_SIGNAL_LABELS[driver.signal as keyof typeof BEHAVIOR_SIGNAL_LABELS];
      return `${label} ${round(driver.value * 100, 1)}%`;
    });

  if (!topDrivers.length) {
    return `${definition.description} Trigger hints: ${definition.triggerHints.join(", ")}.`;
  }

  return `${definition.description} Triggered by ${topDrivers.join(" + ")}.`;
}

export function scoreModifiers(input: {
  metrics: WalletMetrics;
}): ModifierResult[] {
  const signals = deriveBehaviorSignals(input.metrics);

  const ranked = MODIFIER_DEFINITIONS.map((definition) => ({
    definition,
    score: round(scoreDefinition(definition, signals), 2),
  })).sort((a, b) => b.score - a.score);

  // Keep modifier output tight: usually 2-4 strongest modifiers.
  const strongCandidates = ranked.filter((entry) => entry.score >= 52);
  const selected =
    strongCandidates.length >= 2
      ? strongCandidates.slice(0, 4)
      : ranked.slice(0, 2);

  return selected.map((entry) => ({
    id: entry.definition.id,
    displayName: entry.definition.displayName,
    score: entry.score,
    explanation: explainModifier(entry.definition, signals),
  }));
}
