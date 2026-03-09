export type AnalysisRangeHours = 24 | 48 | 72;

export type NormalizedTradeSide = "BUY" | "SELL";

export interface AnalyzeWalletProfileInput {
  wallet: string;
  rangeHours: AnalysisRangeHours;
}

export interface PumpTradeLike {
  timestamp: number;
  signature: string;
  source?: string;
  mint: string;
  symbol?: string;
  name?: string;
  image?: string | null;
  side: "buy" | "sell";
  tokenAmount: number;
  solAmount: number;
}

export type MetricPath =
  | "activity.tradeCount"
  | "activity.distinctTokenCount"
  | "activity.buyCount"
  | "activity.sellCount"
  | "activity.tradesPerHour"
  | "timing.earlyEntryBias"
  | "timing.lateEntryBias"
  | "timing.rapidReentryScore"
  | "timing.nightActivityScore"
  | "holding.avgHoldMinutes"
  | "holding.shortHoldBias"
  | "holding.bagholdBias"
  | "sizing.avgSolPerTrade"
  | "sizing.sizeVariance"
  | "sizing.concentrationScore"
  | "pnl.estimatedPnlSol"
  | "pnl.realizedWinRate"
  | "pnl.biggestWin"
  | "pnl.biggestLoss"
  | "attention.chaseScore"
  | "attention.momentumAlignment"
  | "attention.attentionSensitivity"
  | "risk.drawdownTolerance"
  | "risk.panicExitBias"
  | "risk.averagingDownBias"
  | "behavior.revengeBias"
  | "behavior.chaosScore"
  | "behavior.patienceScore"
  | "behavior.convictionScore"
  | "virality.memeabilityScore"
  | "virality.shareabilityScore"
  | "virality.cinemaScore";

export interface NormalizedTrade {
  signature: string;
  timestamp: number;
  mint: string;
  symbol?: string;
  name?: string;
  image?: string;
  side: NormalizedTradeSide;
  solAmount: number;
  tokenAmount?: number;
  priceEstimate?: number;
  holdDurationMinutes?: number | null;
  pnlSol?: number | null;
  isOpenPosition?: boolean;
  isPumpToken: boolean;
}

export interface ActivityMetrics {
  tradeCount: number;
  distinctTokenCount: number;
  buyCount: number;
  sellCount: number;
  tradesPerHour: number;
  rapidRotationScore: number;
}

export interface TimingMetrics {
  earlyEntryBias: number;
  lateEntryBias: number;
  rapidReentryScore: number;
  nightActivityScore: number;
}

export interface HoldingMetrics {
  avgHoldMinutes: number;
  shortHoldBias: number;
  bagholdBias: number;
}

export interface SizingMetrics {
  avgSolPerTrade: number;
  sizeVariance: number;
  concentrationScore: number;
}

export interface PnlMetrics {
  estimatedPnlSol: number;
  realizedWinRate: number;
  biggestWin: number;
  biggestLoss: number;
}

export interface AttentionMetrics {
  chaseScore: number;
  momentumAlignment: number;
  attentionSensitivity: number;
}

export interface RiskMetrics {
  drawdownTolerance: number;
  panicExitBias: number;
  averagingDownBias: number;
}

export interface BehaviorMetrics {
  revengeBias: number;
  chaosScore: number;
  patienceScore: number;
  convictionScore: number;
}

export interface ViralityMetrics {
  memeabilityScore: number;
  shareabilityScore: number;
  cinemaScore: number;
}

export interface WalletMetrics {
  activity: ActivityMetrics;
  timing: TimingMetrics;
  holding: HoldingMetrics;
  sizing: SizingMetrics;
  pnl: PnlMetrics;
  attention: AttentionMetrics;
  risk: RiskMetrics;
  behavior: BehaviorMetrics;
  virality: ViralityMetrics;
}

export type BehaviorSignalKey =
  | "earlyEntryBehavior"
  | "lateEntryBehavior"
  | "rapidReentryAfterLosses"
  | "averageHoldDuration"
  | "sizeVolatility"
  | "tradeFrequency"
  | "smallWinsTooFast"
  | "holdLosers"
  | "behaviorAfterDrawdowns"
  | "chasingAttention"
  | "concentrationBehavior"
  | "sprayBehavior"
  | "consistencyBehavior"
  | "chaosBehavior"
  | "patienceBehavior"
  | "convictionBehavior"
  | "momentumAddiction"
  | "metaAwareness"
  | "comebackPotential"
  | "luckSkew";

export type BehaviorSignalMap = Record<BehaviorSignalKey, number>;

export interface PersonalityDefinition {
  id: string;
  displayName: string;
  description: string;
  humorStyle: string;
  scoringLogicNotes: string;
  preferredThemes: string[];
  signalWeights: Partial<Record<BehaviorSignalKey, number>>;
}

export interface ModifierDefinition {
  id: string;
  displayName: string;
  description: string;
  triggerHints: string[];
  weightRules: string;
  toneEffect: string;
  signalWeights: Partial<Record<BehaviorSignalKey, number>>;
}

export interface PersonalityScoreResult {
  id: string;
  displayName: string;
  score: number;
  explanation: string;
}

export interface PersonalityProfileResult {
  primary: PersonalityScoreResult;
  secondaryCandidates: Array<{
    id: string;
    displayName: string;
    score: number;
  }>;
}

export interface ModifierResult {
  id: string;
  displayName: string;
  score: number;
  explanation: string;
}

export interface WalletMoment {
  title: string;
  description: string;
  tradeSignatures?: string[];
  explanation: string;
  humorLine: string;
  confidence?: number;
}

export interface WalletMoments {
  absoluteCinemaMoment?: WalletMoment;
  mainCharacterMoment?: WalletMoment;
  trenchLoreMoment?: WalletMoment;
  paperHandsMoment?: WalletMoment;
  diamondHandsMoment?: WalletMoment;
  comebackMoment?: WalletMoment;
  fumbleMoment?: WalletMoment;
  goblinHourMoment?: WalletMoment;
  convictionMoment?: WalletMoment;
  hadToBeThereMoment?: WalletMoment;
  escapeMoment?: WalletMoment;
  overcookedMoment?: WalletMoment;
}

export type StoryBeatPhase =
  | "opening"
  | "rise"
  | "damage"
  | "pivot"
  | "climax"
  | "aftermath";

export interface StoryBeat {
  phase: StoryBeatPhase;
  text: string;
  emotionalTone: string;
  symbolicVisualHint: string;
}

export interface SuitabilityRule {
  metricPath: MetricPath;
  op: "gte" | "lte";
  value: number;
  weight?: number;
}

export interface InterpretationLineTemplate {
  id: string;
  text: string;
  tags: string[];
  suitabilityRules: SuitabilityRule[];
  tone: string;
}

export interface TextTemplate {
  id: string;
  trigger?: string;
  text: string;
  tags?: string[];
}

export interface NarrativeTemplate {
  id: string;
  tone?: string;
  text: string;
  tags?: string[];
}

export interface WritersRoomPersonalityEntry {
  id: string;
  displayName: string;
  description?: string;
  humorStyle?: string;
  themes?: string[];
}

export interface WritersRoomModifierEntry {
  id: string;
  displayName: string;
  description?: string;
  toneEffect?: string;
  triggerHints?: string[];
}

export interface WritersRoomMomentTemplate {
  id: string;
  titleTemplate?: string;
  humorTemplate?: string;
}

export type WritersRoomSource = "file" | "missing" | "malformed";

export interface WritersRoomContent {
  source: WritersRoomSource;
  filePath: string;
  loadedAt: string;
  warnings: string[];
  personalities: Record<string, WritersRoomPersonalityEntry>;
  modifiers: Record<string, WritersRoomModifierEntry>;
  interpretationLines: InterpretationLineTemplate[];
  trenchCopypasta: TextTemplate[];
  moments: Record<string, WritersRoomMomentTemplate>;
  cinematicSummaries: NarrativeTemplate[];
  xLines: NarrativeTemplate[];
}

export interface CinematicSummary {
  title: string;
  tone: string;
  lines: string[];
  templateId?: string;
}

export interface WritersRoomSelections {
  contentSource: WritersRoomSource | "fallback-only";
  interpretationLineIds: string[];
  xLineIds: string[];
  cinematicSummaryId?: string;
  copypastaIds: string[];
}

export interface WalletAnalysisResult {
  wallet: string;
  rangeHours: number;
  normalizedTrades: NormalizedTrade[];
  metrics: WalletMetrics;
  personality: PersonalityProfileResult;
  modifiers: ModifierResult[];
  interpretationLines: string[];
  moments: WalletMoments;
  walletVibeCheck: string;
  cinematicSummary: CinematicSummary;
  xReadyLines: string[];
  storyBeats: StoryBeat[];
  writersRoomSelections: WritersRoomSelections;
}

export interface InterpretationSelectionResult {
  lines: string[];
  ids: string[];
  source: "writers-room" | "fallback";
}

export interface NarrativeSelectionResult {
  walletVibeCheck: string;
  cinematicSummary: CinematicSummary;
  xReadyLines: string[];
  writersRoomSelections: WritersRoomSelections;
}

export type SeedWalletProfileId =
  | "chaotic-overtrader"
  | "early-narrative-trader"
  | "stubborn-bagholder"
  | "pump-chaser"
  | "improbable-comeback-merchant";

export interface SeedWalletBehaviorProfile {
  id: SeedWalletProfileId;
  label: string;
  description: string;
  wallet: string;
  rangeHours: AnalysisRangeHours;
  normalizedTrades: NormalizedTrade[];
}
