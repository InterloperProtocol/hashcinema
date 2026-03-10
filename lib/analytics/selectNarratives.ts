import {
  FALLBACK_CINEMATIC_SUMMARIES,
  FALLBACK_TRENCH_COPYPASTA,
  FALLBACK_X_LINES,
  MAX_X_LINES,
  MIN_X_LINES,
} from "./constants";
import {
  InterpretationSelectionResult,
  NarrativeSelectionResult,
  NarrativeTemplate,
  TextTemplate,
  WalletMetrics,
  WalletMoment,
  WalletMoments,
  WritersRoomContent,
  WritersRoomMomentTemplate,
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

function buildTags(input: {
  metrics: WalletMetrics;
  personalityId: string;
  modifiers: string[];
  moments: WalletMoments;
}): Set<string> {
  const tags = new Set<string>([
    "general",
    slugify(input.personalityId),
    ...input.modifiers.map(slugify),
  ]);

  if (input.metrics.behavior.chaosScore >= 0.55) tags.add("chaos");
  if (input.metrics.behavior.convictionScore >= 0.55) tags.add("conviction");
  if (input.metrics.timing.lateEntryBias >= 0.4) tags.add("late");
  if (input.metrics.timing.earlyEntryBias >= 0.5) tags.add("early");
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
  if (input.metrics.behavior.revengeBias >= 0.4) tags.add("revenge");
  if (input.metrics.holding.bagholdBias >= 0.35) tags.add("baghold");
  if (input.metrics.attention.chaseScore >= 0.5) tags.add("fomo");
  if (input.moments.overcookedMoment) tags.add("overcooked");
  if (input.moments.comebackMoment) tags.add("comeback");

  return tags;
}

function renderTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }, template);
}

const WRITERS_ROOM_MOMENT_MAP: Array<{
  key: keyof WalletMoments;
  templateId: string;
}> = [
  { key: "absoluteCinemaMoment", templateId: "absolute-cinema" },
  { key: "mainCharacterMoment", templateId: "main-character" },
  { key: "trenchLoreMoment", templateId: "trench-lore" },
  { key: "paperHandsMoment", templateId: "paper-hands" },
  { key: "diamondHandsMoment", templateId: "diamond-hands" },
  { key: "comebackMoment", templateId: "comeback" },
  { key: "fumbleMoment", templateId: "fumble" },
  { key: "goblinHourMoment", templateId: "goblin-hour" },
  { key: "convictionMoment", templateId: "conviction" },
  { key: "hadToBeThereMoment", templateId: "had-to-be-there" },
  { key: "escapeMoment", templateId: "escape" },
  { key: "overcookedMoment", templateId: "overcooked" },
];

function renderMomentTemplate(
  template: WritersRoomMomentTemplate | undefined,
  moment: WalletMoment,
  variables: Record<string, string | number>,
): string {
  if (!template) {
    return `${moment.title}: ${moment.humorLine}`;
  }

  const title = template.titleTemplate
    ? renderTemplate(template.titleTemplate, variables)
    : moment.title;
  const humor = template.humorTemplate
    ? renderTemplate(template.humorTemplate, variables)
    : moment.humorLine;

  return `${title}: ${humor}`;
}

function selectMomentTemplateLine(input: {
  writersRoom: WritersRoomContent;
  moments: WalletMoments;
  variables: Record<string, string | number>;
}): string | undefined {
  for (const mapping of WRITERS_ROOM_MOMENT_MAP) {
    const moment = input.moments[mapping.key];
    if (!moment) continue;

    const template = input.writersRoom.moments[mapping.templateId];
    return renderMomentTemplate(template, moment, {
      ...input.variables,
      momentTitle: moment.title,
      momentDescription: moment.description,
      momentHumor: moment.humorLine,
    });
  }

  return undefined;
}

function scoreTemplate(template: NarrativeTemplate, activeTags: Set<string>): number {
  let score = 0.2;
  for (const tag of template.tags ?? []) {
    if (activeTags.has(slugify(tag))) {
      score += 0.4;
    }
  }
  return score;
}

function selectCopypasta(input: {
  writersRoom: WritersRoomContent;
  activeTags: Set<string>;
}): { lines: TextTemplate[]; source: "writers" | "fallback" } {
  const writersCandidates = input.writersRoom.trenchCopypasta.filter(
    (item) => item.id && item.text,
  );

  const scoreItem = (item: TextTemplate) => {
    let score = 0;
    if (item.trigger && input.activeTags.has(slugify(item.trigger))) score += 1.2;
    for (const tag of item.tags ?? []) {
      if (input.activeTags.has(slugify(tag))) score += 0.6;
    }
    return score;
  };

  const rankedWriters = writersCandidates
    .map((item) => ({ item, score: scoreItem(item) }))
    .sort((a, b) => b.score - a.score);

  if (rankedWriters.length) {
    return {
      lines: rankedWriters.slice(0, 2).map((entry) => entry.item),
      source: "writers",
    };
  }

  const rankedFallback = FALLBACK_TRENCH_COPYPASTA
    .map((item) => ({ item, score: scoreItem(item) }))
    .sort((a, b) => b.score - a.score);

  return {
    lines: rankedFallback.slice(0, 2).map((entry) => entry.item),
    source: "fallback",
  };
}

export function selectNarratives(input: {
  wallet: string;
  rangeHours: number;
  metrics: WalletMetrics;
  personality: { primary: { id: string; displayName: string } };
  modifiers: Array<{ id: string; displayName: string }>;
  moments: WalletMoments;
  interpretationSelection: InterpretationSelectionResult;
  writersRoom: WritersRoomContent;
}): NarrativeSelectionResult {
  const walletShort = `${input.wallet.slice(0, 4)}...${input.wallet.slice(-4)}`;
  const personalityEntry = input.writersRoom.personalities[input.personality.primary.id];
  const personalityDisplay =
    personalityEntry?.displayName ?? input.personality.primary.displayName;
  const personalityDescription =
    personalityEntry?.description ?? input.personality.primary.displayName;
  const personalityHumorStyle =
    personalityEntry?.humorStyle ?? "trenches documentary narrator";
  const modifierOne = input.modifiers[0]?.displayName ?? "Chaotic Neutral";
  const modifierTwo = input.modifiers[1]?.displayName ?? modifierOne;
  const modifierEntries = input.modifiers
    .map((modifier) => input.writersRoom.modifiers[modifier.id])
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const modifierTone = modifierEntries
    .map((entry) => entry.toneEffect)
    .filter((tone): tone is string => Boolean(tone))
    .slice(0, 2)
    .join(" + ");

  const activeTags = buildTags({
    metrics: input.metrics,
    personalityId: input.personality.primary.id,
    modifiers: input.modifiers.map((modifier) => modifier.id),
    moments: input.moments,
  });
  for (const theme of personalityEntry?.themes ?? []) {
    activeTags.add(slugify(theme));
  }
  for (const modifierEntry of modifierEntries) {
    for (const hint of modifierEntry.triggerHints ?? []) {
      activeTags.add(slugify(hint));
    }
    if (modifierEntry.toneEffect) {
      activeTags.add(slugify(modifierEntry.toneEffect));
    }
  }

  const templateVariables = {
    walletShort,
    rangeHours: input.rangeHours,
    tradeCount: input.metrics.activity.tradeCount,
    personality: personalityDisplay,
    personalityDescription,
    personalityHumorStyle,
    modifierOne,
    modifierTwo,
    modifierTone: modifierTone || "chaotic-neutral",
  };

  const cinematicCandidates =
    input.writersRoom.cinematicSummaries.length > 0
      ? input.writersRoom.cinematicSummaries
      : FALLBACK_CINEMATIC_SUMMARIES;

  const selectedCinematicTemplate = [...cinematicCandidates]
    .sort((a, b) => scoreTemplate(b, activeTags) - scoreTemplate(a, activeTags))[0];

  const cinematicText = renderTemplate(
    selectedCinematicTemplate?.text ?? "",
    templateVariables,
  );
  const momentTemplateLine = selectMomentTemplateLine({
    writersRoom: input.writersRoom,
    moments: input.moments,
    variables: templateVariables,
  });

  const cinematicLines = [
    cinematicText,
    input.moments.absoluteCinemaMoment?.description ??
      input.moments.mainCharacterMoment?.description ??
      "No single scene dominated, but the tape still wrote a dramatic script.",
    `Net PnL landed at ${input.metrics.pnl.estimatedPnlSol.toFixed(4)} SOL with cinema score ${input.metrics.virality.cinemaScore.toFixed(2)}.`,
    input.interpretationSelection.lines[0] ?? "The village took notes.",
    momentTemplateLine,
    input.moments.hadToBeThereMoment?.humorLine,
  ]
    .filter((line): line is string => Boolean(line && line.trim()))
    .slice(0, 6);

  while (cinematicLines.length < 3) {
    cinematicLines.push("The chart gave chaos. The wallet gave character.");
  }

  const vibeSentences = [
    `${walletShort} fired ${input.metrics.activity.tradeCount} Pump.fun trades across ${input.metrics.activity.distinctTokenCount} tokens in ${input.rangeHours}h and closed at ${input.metrics.pnl.estimatedPnlSol.toFixed(4)} SOL.`,
    `Primary vibe: ${personalityDisplay}, wearing ${modifierOne}${modifierTwo !== modifierOne ? ` and ${modifierTwo}` : ""}.`,
    `${personalityDescription}. Voice: ${personalityHumorStyle}${modifierTone ? ` (${modifierTone})` : ""}.`,
    input.interpretationSelection.lines[1] ?? input.interpretationSelection.lines[0],
    input.moments.absoluteCinemaMoment?.humorLine,
  ].filter((line): line is string => Boolean(line && line.trim()));

  const walletVibeCheck = vibeSentences.slice(0, 4).join(" ");

  const copypasta = selectCopypasta({
    writersRoom: input.writersRoom,
    activeTags,
  });

  const xTarget = clamp(
    Math.round(MIN_X_LINES + input.metrics.activity.tradeCount / 12),
    MIN_X_LINES,
    MAX_X_LINES,
  );

  const xCandidates = [
    ...input.writersRoom.xLines,
    ...FALLBACK_X_LINES,
    {
      id: "generated-facts",
      text: `${walletShort} ran ${input.metrics.activity.tradeCount} trades in ${input.rangeHours}h and still found new emotional lows/highs.`,
      tags: ["cinema"],
    },
    {
      id: "generated-personality",
      text: `${personalityDisplay}: ${modifierOne} edition. ${personalityHumorStyle}.`,
      tags: ["viral"],
    },
    {
      id: "generated-vibe",
      text: `${input.interpretationSelection.lines[0] ?? "This session was pure cinema."}`,
      tags: ["cinema"],
    },
    ...copypasta.lines.map((line) => ({
      id: `copypasta-${line.id}`,
      text: line.text,
      tags: ["copypasta", "viral"],
    })),
  ];

  const rankedX = xCandidates
    .map((candidate) => ({
      candidate,
      score: scoreTemplate(
        {
          id: candidate.id,
          text: candidate.text,
          tags: candidate.tags,
        },
        activeTags,
      ),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.candidate.id.localeCompare(b.candidate.id);
    });

  const xReady: string[] = [];
  const xIds: string[] = [];
  for (const entry of rankedX) {
    if (xReady.length >= xTarget) break;
    if (!xReady.includes(entry.candidate.text)) {
      xReady.push(entry.candidate.text);
      xIds.push(entry.candidate.id);
    }
  }

  while (xReady.length < MIN_X_LINES) {
    const fallback = FALLBACK_X_LINES[xReady.length % FALLBACK_X_LINES.length]!;
    if (!xReady.includes(fallback.text)) {
      xReady.push(fallback.text);
      xIds.push(fallback.id);
    }
  }

  return {
    walletVibeCheck,
    cinematicSummary: {
      title: "Wallet Cinema Cut",
      tone: selectedCinematicTemplate?.tone ?? "trenches",
      lines: cinematicLines,
      templateId: selectedCinematicTemplate?.id,
    },
    xReadyLines: xReady.slice(0, xTarget),
    writersRoomSelections: {
      contentSource:
        input.writersRoom.source === "file" &&
        input.interpretationSelection.source === "writers-room"
          ? "file"
          : input.writersRoom.source === "file"
            ? "fallback-only"
            : input.writersRoom.source,
      interpretationLineIds: input.interpretationSelection.ids,
      xLineIds: xIds.slice(0, xTarget),
      cinematicSummaryId: selectedCinematicTemplate?.id,
      copypastaIds: copypasta.lines.map((line) => line.id),
    },
  };
}
