import { z } from "zod";

export const analyzeWalletProfileInputSchema = z.object({
  wallet: z.string().min(32).max(64),
  rangeHours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
});

export const normalizedTradeSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  mint: z.string().min(1),
  symbol: z.string().optional(),
  name: z.string().optional(),
  image: z.string().optional(),
  side: z.union([z.literal("BUY"), z.literal("SELL")]),
  solAmount: z.number(),
  tokenAmount: z.number().optional(),
  priceEstimate: z.number().optional(),
  holdDurationMinutes: z.number().nullable().optional(),
  pnlSol: z.number().nullable().optional(),
  isOpenPosition: z.boolean().optional(),
  isPumpToken: z.boolean(),
});

const activityMetricsSchema = z.object({
  tradeCount: z.number(),
  distinctTokenCount: z.number(),
  buyCount: z.number(),
  sellCount: z.number(),
  tradesPerHour: z.number(),
  rapidRotationScore: z.number(),
});

const timingMetricsSchema = z.object({
  earlyEntryBias: z.number(),
  lateEntryBias: z.number(),
  rapidReentryScore: z.number(),
  nightActivityScore: z.number(),
});

const holdingMetricsSchema = z.object({
  avgHoldMinutes: z.number(),
  shortHoldBias: z.number(),
  bagholdBias: z.number(),
});

const sizingMetricsSchema = z.object({
  avgSolPerTrade: z.number(),
  sizeVariance: z.number(),
  concentrationScore: z.number(),
});

const pnlMetricsSchema = z.object({
  estimatedPnlSol: z.number(),
  realizedWinRate: z.number(),
  biggestWin: z.number(),
  biggestLoss: z.number(),
});

const attentionMetricsSchema = z.object({
  chaseScore: z.number(),
  momentumAlignment: z.number(),
  attentionSensitivity: z.number(),
});

const riskMetricsSchema = z.object({
  drawdownTolerance: z.number(),
  panicExitBias: z.number(),
  averagingDownBias: z.number(),
});

const behaviorMetricsSchema = z.object({
  revengeBias: z.number(),
  chaosScore: z.number(),
  patienceScore: z.number(),
  convictionScore: z.number(),
});

const viralityMetricsSchema = z.object({
  memeabilityScore: z.number(),
  shareabilityScore: z.number(),
  cinemaScore: z.number(),
});

export const walletMetricsSchema = z.object({
  activity: activityMetricsSchema,
  timing: timingMetricsSchema,
  holding: holdingMetricsSchema,
  sizing: sizingMetricsSchema,
  pnl: pnlMetricsSchema,
  attention: attentionMetricsSchema,
  risk: riskMetricsSchema,
  behavior: behaviorMetricsSchema,
  virality: viralityMetricsSchema,
});

const personalityScoreSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  score: z.number(),
  explanation: z.string().min(1),
});

const personalityCandidateSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  score: z.number(),
});

export const personalityProfileSchema = z.object({
  primary: personalityScoreSchema,
  secondaryCandidates: z.array(personalityCandidateSchema),
});

export const modifierResultSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  score: z.number(),
  explanation: z.string().min(1),
});

export const walletMomentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  tradeSignatures: z.array(z.string()).optional(),
  explanation: z.string().min(1),
  humorLine: z.string().min(1),
  confidence: z.number().optional(),
});

export const walletMomentsSchema = z.object({
  absoluteCinemaMoment: walletMomentSchema.optional(),
  mainCharacterMoment: walletMomentSchema.optional(),
  trenchLoreMoment: walletMomentSchema.optional(),
  paperHandsMoment: walletMomentSchema.optional(),
  diamondHandsMoment: walletMomentSchema.optional(),
  comebackMoment: walletMomentSchema.optional(),
  fumbleMoment: walletMomentSchema.optional(),
  goblinHourMoment: walletMomentSchema.optional(),
  convictionMoment: walletMomentSchema.optional(),
  hadToBeThereMoment: walletMomentSchema.optional(),
  escapeMoment: walletMomentSchema.optional(),
  overcookedMoment: walletMomentSchema.optional(),
});

export const cinematicSummarySchema = z.object({
  title: z.string().min(1),
  tone: z.string().min(1),
  lines: z.array(z.string().min(1)).min(3).max(6),
  templateId: z.string().optional(),
});

export const storyBeatSchema = z.object({
  phase: z.union([
    z.literal("opening"),
    z.literal("rise"),
    z.literal("damage"),
    z.literal("pivot"),
    z.literal("climax"),
    z.literal("aftermath"),
  ]),
  text: z.string().min(1),
  emotionalTone: z.string().min(1),
  symbolicVisualHint: z.string().min(1),
});

export const writersRoomSelectionsSchema = z.object({
  contentSource: z.union([
    z.literal("file"),
    z.literal("missing"),
    z.literal("malformed"),
    z.literal("fallback-only"),
  ]),
  interpretationLineIds: z.array(z.string()),
  xLineIds: z.array(z.string()),
  cinematicSummaryId: z.string().optional(),
  copypastaIds: z.array(z.string()),
});

export const walletAnalysisResultSchema = z.object({
  wallet: z.string().min(1),
  rangeHours: z.number(),
  normalizedTrades: z.array(normalizedTradeSchema),
  metrics: walletMetricsSchema,
  personality: personalityProfileSchema,
  modifiers: z.array(modifierResultSchema),
  interpretationLines: z.array(z.string().min(1)).min(5).max(10),
  moments: walletMomentsSchema,
  walletVibeCheck: z.string().min(1),
  cinematicSummary: cinematicSummarySchema,
  xReadyLines: z.array(z.string().min(1)).min(5).max(10),
  storyBeats: z.array(storyBeatSchema).min(5).max(8),
  writersRoomSelections: writersRoomSelectionsSchema,
});
