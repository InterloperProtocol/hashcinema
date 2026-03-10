import {
  FALLBACK_INTERPRETATION_LINES,
  MAX_INTERPRETATION_LINES,
  MIN_INTERPRETATION_LINES,
} from "./constants";
import {
  InterpretationLineTemplate,
  InterpretationSelectionResult,
  MetricPath,
  WalletMetrics,
  WalletMoments,
  WritersRoomContent,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function metricValue(metrics: WalletMetrics, path: MetricPath): number {
  const [group, key] = path.split(".") as [keyof WalletMetrics, string];
  const bucket = (metrics as unknown as Record<string, Record<string, number>>)[
    group
  ];
  return bucket?.[key] ?? 0;
}

function evaluateLine(
  line: InterpretationLineTemplate,
  metrics: WalletMetrics,
  activeTags: Set<string>,
): number {
  let score = 0.2;

  for (const tag of line.tags) {
    if (activeTags.has(tag)) {
      score += 0.35;
    }
  }

  if (!line.suitabilityRules.length) {
    score += 0.1;
    return score;
  }

  for (const rule of line.suitabilityRules) {
    const value = metricValue(metrics, rule.metricPath);
    const weight = rule.weight ?? 1;
    const matches = rule.op === "gte" ? value >= rule.value : value <= rule.value;
    score += matches ? weight : -weight * 0.25;
  }

  return score;
}

function buildActiveTags(input: {
  metrics: WalletMetrics;
  personalityId: string;
  personalityName: string;
  modifierIds: string[];
  moments: WalletMoments;
}): Set<string> {
  const tags = new Set<string>([
    "universal",
    slugify(input.personalityId),
    slugify(input.personalityName),
    ...input.modifierIds.map(slugify),
  ]);

  if (input.metrics.behavior.chaosScore >= 0.55) tags.add("chaos");
  if (input.metrics.behavior.convictionScore >= 0.55) tags.add("conviction");
  if (input.metrics.timing.lateEntryBias >= 0.4) tags.add("late");
  if (input.metrics.timing.earlyEntryBias >= 0.5) tags.add("early");
  if (input.metrics.holding.bagholdBias >= 0.35) tags.add("baghold");
  if (input.metrics.virality.cinemaScore >= 0.5) tags.add("cinema");
  if (input.metrics.virality.memeabilityScore >= 0.5) tags.add("viral");
  if (input.metrics.attention.attentionSensitivity >= 0.5) tags.add("attention");
  if (
    input.metrics.behavior.patienceScore >= 0.6 &&
    input.metrics.behavior.chaosScore <= 0.45
  ) {
    tags.add("discipline");
  }
  if (input.metrics.activity.tradesPerHour >= 0.35) tags.add("overtrading");
  if (input.metrics.activity.tradesPerHour <= 0.08) tags.add("no-trade");
  if (
    input.metrics.timing.lateEntryBias >= 0.55 &&
    input.metrics.behavior.chaosScore >= 0.55
  ) {
    tags.add("new-pairs");
  }
  if (
    input.metrics.behavior.patienceScore >= 0.55 &&
    input.metrics.activity.tradesPerHour <= 0.15
  ) {
    tags.add("consistency");
  }
  tags.add("culture");
  if (input.metrics.timing.nightActivityScore >= 0.35) tags.add("night");
  if (input.metrics.behavior.revengeBias >= 0.4) tags.add("revenge");
  if (input.metrics.attention.chaseScore >= 0.5) tags.add("momentum");

  if (input.moments.paperHandsMoment) tags.add("paper-hands");
  if (input.moments.diamondHandsMoment) tags.add("diamond");
  if (input.moments.overcookedMoment) tags.add("overcooked");
  if (input.moments.comebackMoment) tags.add("comeback");

  return tags;
}

export function selectInterpretationLines(input: {
  metrics: WalletMetrics;
  personality: { primary: { id: string; displayName: string } };
  modifiers: Array<{ id: string }>;
  moments: WalletMoments;
  writersRoom: WritersRoomContent;
}): InterpretationSelectionResult {
  const desiredCount = clamp(
    Math.round(MIN_INTERPRETATION_LINES + input.metrics.activity.tradeCount / 10),
    MIN_INTERPRETATION_LINES,
    MAX_INTERPRETATION_LINES,
  );

  const activeTags = buildActiveTags({
    metrics: input.metrics,
    personalityId: input.personality.primary.id,
    personalityName: input.personality.primary.displayName,
    modifierIds: input.modifiers.map((modifier) => modifier.id),
    moments: input.moments,
  });

  const writersCandidates = input.writersRoom.interpretationLines.filter(
    (line) => line.id && line.text,
  );

  const fallbackCandidates = FALLBACK_INTERPRETATION_LINES;

  // Suitability rules + tag matching keeps line selection deterministic and behavior-driven.
  const rank = (lines: InterpretationLineTemplate[]) =>
    lines
      .map((line) => ({ line, score: evaluateLine(line, input.metrics, activeTags) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.line.id.localeCompare(b.line.id);
      });

  const rankedWriters = rank(writersCandidates);
  const rankedFallback = rank(fallbackCandidates);

  const selected = new Map<string, string>();
  const selectedIds: string[] = [];

  for (const entry of rankedWriters) {
    if (selected.size >= desiredCount) break;
    if (!selected.has(entry.line.id)) {
      selected.set(entry.line.id, entry.line.text);
      selectedIds.push(entry.line.id);
    }
  }

  for (const entry of rankedFallback) {
    if (selected.size >= desiredCount) break;
    if (!selected.has(entry.line.id)) {
      selected.set(entry.line.id, entry.line.text);
      selectedIds.push(entry.line.id);
    }
  }

  if (selected.size < MIN_INTERPRETATION_LINES) {
    for (const line of fallbackCandidates) {
      if (selected.size >= MIN_INTERPRETATION_LINES) break;
      if (!selected.has(line.id)) {
        selected.set(line.id, line.text);
        selectedIds.push(line.id);
      }
    }
  }

  const source = rankedWriters.length > 0 && selectedIds.some((id) =>
    writersCandidates.some((line) => line.id === id),
  )
    ? "writers-room"
    : "fallback";

  return {
    lines: [...selected.values()].slice(0, desiredCount),
    ids: selectedIds.slice(0, desiredCount),
    source,
  };
}
