import { round } from "@/lib/utils";
import {
  ReportDocument,
  ReportTimelineItem,
  WalletBehavioralMetrics,
  WalletKeyEvent,
  WalletKeyEventType,
  WalletProfile,
  WalletStory,
} from "@/lib/types/domain";
import {
  CinematicSummary,
  ModifierResult,
  NormalizedTrade,
  StoryBeat,
  WalletAnalysisResult,
  WalletMoment,
  WalletMoments,
} from "@/lib/analytics/types";

interface LegacyAdapterInput {
  jobId: string;
  wallet: string;
  rangeDays: number;
  packageType: WalletStory["packageType"];
  durationSeconds: number;
  analysis: WalletAnalysisResult;
  analysisEngine: "v2" | "legacy-fallback";
}

interface LegacyArtifacts {
  report: Omit<ReportDocument, "summary" | "downloadUrl">;
  story: WalletStory;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function formatSignedSol(value: number): string {
  const rounded = round(value, 4);
  return `${rounded >= 0 ? "+" : ""}${rounded} SOL`;
}

function formatTradeLabel(trade: NormalizedTrade | undefined, pnl: number): string {
  if (!trade) {
    return `N/A (${formatSignedSol(pnl)})`;
  }
  const symbol = trade.symbol ?? trade.name ?? trade.mint.slice(0, 6);
  return `${symbol} (${formatSignedSol(pnl)})`;
}

function toTimeline(trades: NormalizedTrade[]): ReportTimelineItem[] {
  return trades.map((trade) => ({
    timestamp: trade.timestamp,
    signature: trade.signature,
    mint: trade.mint,
    symbol: trade.symbol ?? trade.name ?? trade.mint.slice(0, 6),
    side: trade.side === "BUY" ? "buy" : "sell",
    tokenAmount: round(trade.tokenAmount ?? 0, 6),
    solAmount: round(trade.solAmount, 6),
  }));
}

function pickMomentSignatures(moment: WalletMoment | undefined): string[] {
  if (!moment?.tradeSignatures?.length) return [];
  return moment.tradeSignatures.filter(Boolean);
}

function momentToLegacyEvent(
  type: WalletKeyEventType,
  moment: WalletMoment | undefined,
): WalletKeyEvent | null {
  if (!moment) return null;
  const signature = pickMomentSignatures(moment)[0] ?? "n/a";
  return {
    type,
    timestamp: Math.floor(Date.now() / 1000),
    token: "PUMP",
    signature,
    tradeContext: moment.description,
    interpretation: `${moment.explanation} ${moment.humorLine}`.trim(),
  };
}

function buildKeyEvents(moments: WalletMoments): WalletKeyEvent[] {
  const candidates: Array<WalletKeyEvent | null> = [
    momentToLegacyEvent("largest_gain", moments.mainCharacterMoment),
    momentToLegacyEvent("largest_loss", moments.fumbleMoment),
    momentToLegacyEvent("rapid_reversal", moments.comebackMoment),
    momentToLegacyEvent("panic_exit", moments.paperHandsMoment),
    momentToLegacyEvent(
      "revenge_trade",
      moments.overcookedMoment ?? moments.goblinHourMoment,
    ),
  ];

  return candidates.filter((event): event is WalletKeyEvent => Boolean(event));
}

function buildLegacyBehaviorMetrics(
  analysis: WalletAnalysisResult,
  rangeDays: number,
): WalletBehavioralMetrics {
  const trades = [...analysis.normalizedTrades].sort((a, b) => a.timestamp - b.timestamp);
  const closedTrades = trades.filter(
    (trade) => trade.side === "SELL" && typeof trade.pnlSol === "number",
  );
  const openPositions = trades.filter(
    (trade) => trade.side === "BUY" && trade.isOpenPosition,
  );
  const gaps: number[] = [];
  for (let i = 1; i < trades.length; i += 1) {
    gaps.push((trades[i]!.timestamp - trades[i - 1]!.timestamp) / 60);
  }

  const winnerHolds = closedTrades
    .filter((trade) => (trade.pnlSol ?? 0) > 0)
    .map((trade) => trade.holdDurationMinutes ?? 0);
  const loserHolds = closedTrades
    .filter((trade) => (trade.pnlSol ?? 0) < 0)
    .map((trade) => trade.holdDurationMinutes ?? 0);

  return {
    totalTrades: analysis.metrics.activity.tradeCount,
    buyCount: analysis.metrics.activity.buyCount,
    sellCount: analysis.metrics.activity.sellCount,
    closedTradeCount: closedTrades.length,
    openPositionCount: openPositions.length,
    tradesPerDay: round(analysis.metrics.activity.tradeCount / Math.max(1, rangeDays), 4),
    medianMinutesBetweenTrades: round(median(gaps), 4),
    nightTradeRatio: analysis.metrics.timing.nightActivityScore,
    lateMomentumEntryRatio: analysis.metrics.timing.lateEntryBias,
    prematureExitRatio: analysis.metrics.holding.shortHoldBias,
    rapidFlipRatio: analysis.metrics.holding.shortHoldBias,
    rapidRotationRatio: analysis.metrics.activity.rapidRotationScore,
    postLossReentryCount: Math.round(
      analysis.metrics.timing.rapidReentryScore * Math.max(1, analysis.metrics.activity.sellCount),
    ),
    averageHoldingMinutes: analysis.metrics.holding.avgHoldMinutes,
    medianHoldingMinutes: analysis.metrics.holding.avgHoldMinutes,
    averageWinnerHoldMinutes: round(
      winnerHolds.length
        ? winnerHolds.reduce((sum, value) => sum + value, 0) / winnerHolds.length
        : 0,
      4,
    ),
    averageLoserHoldMinutes: round(
      loserHolds.length
        ? loserHolds.reduce((sum, value) => sum + value, 0) / loserHolds.length
        : 0,
      4,
    ),
    positionSizeConsistency: analysis.metrics.sizing.sizeVariance,
    tokenConcentration: analysis.metrics.sizing.concentrationScore,
  };
}

function buildStyleClassification(
  analysis: WalletAnalysisResult,
  modifiers: ModifierResult[],
): string {
  const modifier = modifiers[0]?.displayName;
  if (!modifier) return analysis.personality.primary.displayName;
  return `${analysis.personality.primary.displayName} (${modifier})`;
}

function buildMemorableMoments(moments: WalletMoments): string[] {
  return Object.values(moments)
    .filter((moment): moment is WalletMoment => Boolean(moment))
    .slice(0, 4)
    .map((moment) => `${moment.description} ${moment.humorLine}`.trim());
}

function ensureArrayRange(values: string[], min: number, max: number, fallback: string[]): string[] {
  const deduped = [...new Set(values.filter(Boolean))];
  for (const item of fallback) {
    if (deduped.length >= min) break;
    if (!deduped.includes(item)) {
      deduped.push(item);
    }
  }
  return deduped.slice(0, max);
}

function mapStoryBeats(beats: StoryBeat[]): string[] {
  return beats.map((beat) => beat.text);
}

function mapLegacyProfile(
  analysis: WalletAnalysisResult,
  styleClassification: string,
  keyEvents: WalletKeyEvent[],
  legacyMetrics: WalletBehavioralMetrics,
): WalletProfile {
  return {
    personality: analysis.personality.primary.displayName,
    secondaryPersonality: analysis.personality.secondaryCandidates[0]?.displayName ?? null,
    modifiers: analysis.modifiers.map((modifier) => modifier.displayName),
    behavioralSummary: ensureArrayRange(
      analysis.interpretationLines,
      3,
      6,
      [
        "This wallet bought excitement and sold comfort.",
        "Facts first: behavior skewed toward momentum and emotion.",
        "The timeline reads like trench-native improv theatre.",
      ],
    ),
    keyEvents,
    tradingStyle: styleClassification,
    narrativeSummary: analysis.walletVibeCheck,
    storyBeats: mapStoryBeats(analysis.storyBeats),
    metrics: legacyMetrics,
  };
}

export function adaptWalletAnalysisToLegacyArtifacts(
  input: LegacyAdapterInput,
): LegacyArtifacts {
  const analysis = input.analysis;
  const timeline = toTimeline(analysis.normalizedTrades);
  const legacyMetrics = buildLegacyBehaviorMetrics(analysis, input.rangeDays);
  const styleClassification = buildStyleClassification(analysis, analysis.modifiers);
  const keyEvents = buildKeyEvents(analysis.moments);

  const solSpent = round(
    analysis.normalizedTrades
      .filter((trade) => trade.side === "BUY")
      .reduce((sum, trade) => sum + trade.solAmount, 0),
    6,
  );
  const solReceived = round(
    analysis.normalizedTrades
      .filter((trade) => trade.side === "SELL")
      .reduce((sum, trade) => sum + trade.solAmount, 0),
    6,
  );

  const closedTrades = analysis.normalizedTrades.filter(
    (trade) => trade.side === "SELL" && typeof trade.pnlSol === "number",
  );

  const best = closedTrades.reduce<NormalizedTrade | undefined>((currentBest, trade) => {
    if (!currentBest) return trade;
    return (trade.pnlSol ?? 0) > (currentBest.pnlSol ?? 0) ? trade : currentBest;
  }, undefined);
  const worst = closedTrades.reduce<NormalizedTrade | undefined>((currentWorst, trade) => {
    if (!currentWorst) return trade;
    return (trade.pnlSol ?? 0) < (currentWorst.pnlSol ?? 0) ? trade : currentWorst;
  }, undefined);

  const bestTrade = formatTradeLabel(best, best?.pnlSol ?? 0);
  const worstTrade = formatTradeLabel(worst, worst?.pnlSol ?? 0);

  const profile = mapLegacyProfile(analysis, styleClassification, keyEvents, legacyMetrics);
  const memorableMoments = buildMemorableMoments(analysis.moments);
  const storyBeats = mapStoryBeats(analysis.storyBeats);
  const funObservations = ensureArrayRange(
    [...analysis.interpretationLines.slice(0, 3), ...analysis.xReadyLines.slice(0, 3)],
    3,
    5,
    [
      "The chart and your emotions kept swapping custody.",
      "This was strategy-adjacent but cinema-definite.",
      "Village elders requested one less revenge candle.",
    ],
  );

  const report: Omit<ReportDocument, "summary" | "downloadUrl"> = {
    jobId: input.jobId,
    wallet: input.wallet,
    rangeDays: input.rangeDays,
    pumpTokensTraded: analysis.metrics.activity.distinctTokenCount,
    buyCount: analysis.metrics.activity.buyCount,
    sellCount: analysis.metrics.activity.sellCount,
    solSpent,
    solReceived,
    estimatedPnlSol: round(analysis.metrics.pnl.estimatedPnlSol, 6),
    bestTrade,
    worstTrade,
    styleClassification,
    timeline,
    walletPersonality: analysis.personality.primary.displayName,
    walletSecondaryPersonality: analysis.personality.secondaryCandidates[0]?.displayName ?? null,
    walletModifiers: analysis.modifiers.map((modifier) => modifier.displayName),
    behaviorPatterns: ensureArrayRange(
      analysis.interpretationLines,
      3,
      6,
      ["Behavior clustered around momentum and reactive execution."],
    ),
    memorableMoments,
    funObservations,
    narrativeSummary: analysis.walletVibeCheck,
    storyBeats,
    keyEvents,
    walletProfile: profile,
    analysisV2: {
      schemaVersion: "wallet-analysis.v1",
      generatedAt: new Date().toISOString(),
      engine: input.analysisEngine,
      payload: analysis,
    },
  };

  const story: WalletStory = {
    wallet: input.wallet,
    rangeDays: input.rangeDays,
    packageType: input.packageType,
    durationSeconds: input.durationSeconds,
    analytics: {
      pumpTokensTraded: report.pumpTokensTraded,
      buyCount: report.buyCount,
      sellCount: report.sellCount,
      solSpent: report.solSpent,
      solReceived: report.solReceived,
      estimatedPnlSol: report.estimatedPnlSol,
      bestTrade: report.bestTrade,
      worstTrade: report.worstTrade,
      styleClassification: report.styleClassification,
    },
    timeline,
    walletPersonality: report.walletPersonality,
    walletSecondaryPersonality: report.walletSecondaryPersonality,
    walletModifiers: report.walletModifiers,
    behaviorPatterns: report.behaviorPatterns,
    memorableMoments: report.memorableMoments,
    funObservations: report.funObservations,
    narrativeSummary: report.narrativeSummary,
    storyBeats: report.storyBeats,
    keyEvents: report.keyEvents,
    walletProfile: report.walletProfile,
  };

  return { report, story };
}

function fallbackMomentFromEvent(event: WalletKeyEvent | undefined): WalletMoment | undefined {
  if (!event) return undefined;
  return {
    title: event.type.replace(/_/g, " "),
    description: event.tradeContext,
    tradeSignatures: [event.signature],
    explanation: event.interpretation,
    humorLine: event.interpretation,
    confidence: 0.45,
  };
}

function fallbackCinematicSummary(report: ReportDocument, story: WalletStory): CinematicSummary {
  const lines = ensureArrayRange(
    [
      report.narrativeSummary ?? "",
      ...(report.storyBeats ?? []),
      report.summary,
    ],
    3,
    6,
    [
      "Facts confirmed. Emotions active.",
      "The timeline delivered volatility and lore.",
      "This wallet left the window with cinematic residue.",
    ],
  );

  return {
    title: "Wallet Cinema Cut",
    tone: "legacy-fallback",
    lines,
    templateId: "legacy-fallback-summary",
  };
}

function mapLegacyMetricsToV2(report: ReportDocument, rangeHours: number): WalletAnalysisResult["metrics"] {
  const tradesPerHour = rangeHours > 0 ? report.timeline.length / rangeHours : 0;
  const concentration = report.walletProfile?.metrics.tokenConcentration ?? 0;
  const chaos = report.walletProfile?.metrics.rapidRotationRatio ?? 0;
  const patience = Math.max(0, 1 - (report.walletProfile?.metrics.prematureExitRatio ?? 0));

  return {
    activity: {
      tradeCount: report.timeline.length,
      distinctTokenCount: report.pumpTokensTraded,
      buyCount: report.buyCount,
      sellCount: report.sellCount,
      tradesPerHour: round(tradesPerHour, 4),
      rapidRotationScore: report.walletProfile?.metrics.rapidRotationRatio ?? 0,
    },
    timing: {
      earlyEntryBias: Math.max(0, 1 - (report.walletProfile?.metrics.lateMomentumEntryRatio ?? 0)),
      lateEntryBias: report.walletProfile?.metrics.lateMomentumEntryRatio ?? 0,
      rapidReentryScore: Math.min(
        1,
        (report.walletProfile?.metrics.postLossReentryCount ?? 0) / Math.max(1, report.sellCount),
      ),
      nightActivityScore: report.walletProfile?.metrics.nightTradeRatio ?? 0,
    },
    holding: {
      avgHoldMinutes: report.walletProfile?.metrics.averageHoldingMinutes ?? 0,
      shortHoldBias: report.walletProfile?.metrics.prematureExitRatio ?? 0,
      bagholdBias: Math.min(1, (report.walletProfile?.metrics.averageLoserHoldMinutes ?? 0) / 240),
    },
    sizing: {
      avgSolPerTrade: report.timeline.length ? round(report.solSpent / Math.max(1, report.buyCount), 6) : 0,
      sizeVariance: report.walletProfile?.metrics.positionSizeConsistency ?? 0,
      concentrationScore: concentration,
    },
    pnl: {
      estimatedPnlSol: report.estimatedPnlSol,
      realizedWinRate:
        report.sellCount > 0
          ? round(
              report.timeline.filter((item) => item.side === "sell" && item.solAmount > 0).length /
                report.sellCount,
              4,
            )
          : 0,
      biggestWin: report.bestTrade.includes("SOL")
        ? Number(report.bestTrade.match(/[-+]?\d+(\.\d+)?/)?.[0] ?? 0)
        : 0,
      biggestLoss: report.worstTrade.includes("SOL")
        ? Number(report.worstTrade.match(/[-+]?\d+(\.\d+)?/)?.[0] ?? 0)
        : 0,
    },
    attention: {
      chaseScore: report.walletProfile?.metrics.lateMomentumEntryRatio ?? 0,
      momentumAlignment: Math.max(0, 1 - (report.walletProfile?.metrics.prematureExitRatio ?? 0)),
      attentionSensitivity: Math.min(
        1,
        ((report.walletProfile?.metrics.nightTradeRatio ?? 0) + chaos) / 2,
      ),
    },
    risk: {
      drawdownTolerance: Math.min(
        1,
        (report.walletProfile?.metrics.averageLoserHoldMinutes ?? 0) /
          Math.max(1, report.walletProfile?.metrics.averageWinnerHoldMinutes ?? 1),
      ),
      panicExitBias: report.walletProfile?.metrics.prematureExitRatio ?? 0,
      averagingDownBias: Math.min(
        1,
        (report.walletProfile?.metrics.postLossReentryCount ?? 0) / Math.max(1, report.buyCount),
      ),
    },
    behavior: {
      revengeBias: Math.min(
        1,
        (report.walletProfile?.metrics.postLossReentryCount ?? 0) / Math.max(1, report.sellCount),
      ),
      chaosScore: chaos,
      patienceScore: patience,
      convictionScore: concentration,
    },
    virality: {
      memeabilityScore: Math.min(1, (chaos + (report.walletProfile?.metrics.nightTradeRatio ?? 0)) / 2),
      shareabilityScore: Math.min(
        1,
        (Math.abs(report.estimatedPnlSol) / Math.max(0.5, report.solSpent || 0.5)) * 0.6 + chaos * 0.4,
      ),
      cinemaScore: Math.min(
        1,
        (Math.abs(report.estimatedPnlSol) / Math.max(0.5, report.solSpent || 0.5)) * 0.5 + chaos * 0.5,
      ),
    },
  };
}

export function buildFallbackAnalysisFromLegacyArtifacts(input: {
  report: Omit<ReportDocument, "summary" | "downloadUrl">;
  summary: string;
  story: WalletStory;
  rangeHours: number;
}): WalletAnalysisResult {
  const report = input.report;
  const summary = input.summary;
  const legacyMetrics = report.walletProfile?.metrics;

  const normalizedTrades: NormalizedTrade[] = report.timeline.map((item) => ({
    signature: item.signature,
    timestamp: item.timestamp,
    mint: item.mint,
    symbol: item.symbol,
    side: item.side === "buy" ? "BUY" : "SELL",
    solAmount: item.solAmount,
    tokenAmount: item.tokenAmount,
    holdDurationMinutes: null,
    pnlSol: null,
    isOpenPosition: false,
    isPumpToken: true,
  }));

  const interpretationLines = ensureArrayRange(
    [
      ...(report.behaviorPatterns ?? []),
      ...(report.funObservations ?? []),
      report.narrativeSummary ?? "",
    ],
    5,
    10,
    [
      "Facts first: this wallet traded with visible emotional volatility.",
      "Momentum was respected, comfort was not.",
      "This session behaved like live trench theatre.",
      "Risk appetite stayed high through adversity.",
      "The tape and the trader kept negotiating in public.",
    ],
  );

  const xReadyLines = ensureArrayRange(
    [
      ...(report.funObservations ?? []),
      ...(report.memorableMoments ?? []),
      `Wallet closed the window at ${report.estimatedPnlSol.toFixed(4)} SOL.`,
    ],
    5,
    10,
    [
      "You traded like the market personally owed you closure.",
      "This was strategy-adjacent, cinema-definite.",
      "Village consensus: one less revenge candle next time.",
      "You were not trading. You were negotiating with fate.",
      "Brother this was cinema.",
    ],
  );

  const fallbackBeats = ensureArrayRange(
    report.storyBeats ?? input.story.storyBeats ?? [],
    5,
    8,
    [
      "Opening: The wallet entered with confidence and immediate activity.",
      "Rise: Early momentum created conviction and faster execution.",
      "Damage: Volatility introduced visible decision stress.",
      "Pivot: The strategy shifted from reaction toward control.",
      "Climax: Highest-volatility sequence defined the window.",
      "Aftermath: Session closed with a battle-worn PnL.",
    ],
  );

  const phases: StoryBeat["phase"][] = [
    "opening",
    "rise",
    "damage",
    "pivot",
    "climax",
    "aftermath",
  ];
  const storyBeats: StoryBeat[] = fallbackBeats.map((text, index) => ({
    phase: phases[Math.min(index, phases.length - 1)]!,
    text,
    emotionalTone: "legacy-fallback",
    symbolicVisualHint: "chart replay",
  }));

  const keyEvents = report.keyEvents ?? [];
  const moments: WalletMoments = {
    mainCharacterMoment: fallbackMomentFromEvent(
      keyEvents.find((event) => event.type === "largest_gain"),
    ),
    fumbleMoment: fallbackMomentFromEvent(
      keyEvents.find((event) => event.type === "largest_loss"),
    ),
    comebackMoment: fallbackMomentFromEvent(
      keyEvents.find((event) => event.type === "rapid_reversal"),
    ),
    paperHandsMoment: fallbackMomentFromEvent(
      keyEvents.find((event) => event.type === "panic_exit"),
    ),
    overcookedMoment: fallbackMomentFromEvent(
      keyEvents.find((event) => event.type === "revenge_trade"),
    ),
  };
  if (moments.mainCharacterMoment) {
    moments.absoluteCinemaMoment = {
      ...moments.mainCharacterMoment,
      title: "Absolute Cinema Moment",
      humorLine: "Brother this was cinema.",
    };
  }

  return {
    wallet: report.wallet,
    rangeHours: input.rangeHours,
    normalizedTrades,
    metrics: mapLegacyMetricsToV2(report as ReportDocument, input.rangeHours),
    personality: {
      primary: {
        id: (report.walletPersonality ?? "casino-tourist").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        displayName: report.walletPersonality ?? "The Casino Tourist",
        score: 52,
        explanation: "Generated from legacy compute fallback payload mapping.",
      },
      secondaryCandidates: report.walletSecondaryPersonality
        ? [
            {
              id: report.walletSecondaryPersonality.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              displayName: report.walletSecondaryPersonality,
              score: 45,
            },
          ]
        : [],
    },
    modifiers: (report.walletModifiers ?? []).slice(0, 4).map((displayName, index) => ({
      id: displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      displayName,
      score: 70 - index * 7,
      explanation: "Mapped from legacy modifier output during fallback.",
    })),
    interpretationLines,
    moments,
    walletVibeCheck: report.narrativeSummary ?? summary,
    cinematicSummary: fallbackCinematicSummary({ ...report, summary } as ReportDocument, input.story),
    xReadyLines,
    storyBeats,
    writersRoomSelections: {
      contentSource: "fallback-only",
      interpretationLineIds: interpretationLines.map((_, index) => `legacy-fallback-line-${index + 1}`),
      xLineIds: xReadyLines.map((_, index) => `legacy-fallback-x-${index + 1}`),
      cinematicSummaryId: "legacy-fallback-summary",
      copypastaIds: [],
    },
  };
}

