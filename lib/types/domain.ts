import type {
  SceneState,
  VideoIdentitySheet,
  VideoPromptScene,
  WalletAnalysisResult,
} from "@/lib/analytics/types";

export type PackageType = "1d" | "2d" | "3d";

export type JobRequestKind =
  | "wallet_recap"
  | "token_video"
  | "generic_cinema"
  | "bedtime_story"
  | "music_video"
  | "scene_recreation";

export type CinemaPricingMode = "legacy" | "public" | "private";

export type CinemaVisibility = "public" | "private";

export type CinemaExperience =
  | "legacy"
  | "hashcinema"
  | "trenchcinema"
  | "funcinema"
  | "familycinema"
  | "musicvideo"
  | "recreator";

export type ModerationStatus = "visible" | "flagged" | "hidden";

export type SupportedTokenChain = "solana" | "ethereum" | "bsc" | "base";

export type RequestedTokenChain = SupportedTokenChain | "auto";

export type VideoStyleId =
  | "hyperflow_assembly"
  | "trading_card"
  | "trench_neon"
  | "mythic_poster"
  | "glass_signal";

export type PaymentMethod = "sol_dedicated_address" | "x402_usdc";

export type PaymentCurrency = "SOL" | "USDC";

export type JobStatus =
  | "awaiting_payment"
  | "payment_detected"
  | "payment_confirmed"
  | "processing"
  | "complete"
  | "failed";

export type JobProgress =
  | "awaiting_payment"
  | "payment_detected"
  | "payment_confirmed"
  | "fetching_transactions"
  | "filtering_pump_activity"
  | "generating_report"
  | "generating_script"
  | "generating_video"
  | "uploading_assets"
  | "complete"
  | "failed";

export interface JobPackage {
  packageType: PackageType;
  rangeDays: number;
  priceSol: number;
  priceUsdc: number;
  videoSeconds: number;
  enabled?: boolean;
  label?: string;
  subtitle?: string;
}

export interface TokenLink {
  label: string;
  url: string;
}

export interface TokenMarketSnapshot {
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  pairUrl: string | null;
}

export interface StoryCard {
  id: string;
  phase: "hook" | "build" | "payoff" | "continuation";
  title: string;
  teaser: string;
  visualCue: string;
  narrationCue: string;
  transitionLabel: string;
}

export type TianezhaTestVerdict = "pass" | "warn" | "fail";

export interface TianezhaWorldbuilderTest {
  name: string;
  verdict: TianezhaTestVerdict;
  detail: string;
}

export interface TianezhaWorldbuilderState {
  model: "tianezha";
  worldName: string;
  sourceKind?: JobRequestKind;
  knowledgeBase?: string[];
  manifold: {
    anchorPoints: string[];
    tangentVectors: string[];
    continuityRules: string[];
  };
  storyline: string[];
  tests: TianezhaWorldbuilderTest[];
  verdict: TianezhaTestVerdict;
  summary: string;
}

export interface JobDocument {
  jobId: string;
  wallet: string;
  requestKind?: JobRequestKind;
  pricingMode?: CinemaPricingMode;
  visibility?: CinemaVisibility;
  experience?: CinemaExperience;
  moderationStatus?: ModerationStatus;
  creatorId?: string | null;
  creatorEmail?: string | null;
  subjectAddress?: string;
  subjectChain?: SupportedTokenChain | null;
  subjectName?: string | null;
  subjectSymbol?: string | null;
  subjectImage?: string | null;
  subjectDescription?: string | null;
  sourceMediaUrl?: string | null;
  sourceEmbedUrl?: string | null;
  sourceMediaProvider?: string | null;
  sourceTranscript?: string | null;
  stylePreset?: VideoStyleId | null;
  requestedPrompt?: string | null;
  audioEnabled?: boolean | null;
  packageType: PackageType;
  rangeDays: number;
  priceSol: number;
  priceUsdc?: number;
  videoSeconds: number;
  status: JobStatus;
  progress: JobProgress;
  txSignature: string | null;
  createdAt: string;
  updatedAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  paymentMethod?: PaymentMethod;
  paymentCurrency?: PaymentCurrency;
  paymentNetwork?: "solana";
  x402Transaction?: string | null;
  paymentAddress: string;
  paymentIndex: number | null;
  paymentRouting: "dedicated_address" | "legacy_memo" | "x402";
  requiredLamports: number;
  receivedLamports: number;
  paymentSignatures: string[];
  lastPaymentAt: string | null;
  sweepStatus: "pending" | "swept" | "failed";
  sweepSignature: string | null;
  sweptLamports: number;
  lastSweepAt: string | null;
  sweepError: string | null;
}

export interface ReportTimelineItem {
  timestamp: number;
  signature: string;
  mint: string;
  symbol: string;
  name?: string;
  image?: string | null;
  side: "buy" | "sell";
  tokenAmount: number;
  solAmount: number;
}

export interface WalletBehavioralMetrics {
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  closedTradeCount: number;
  openPositionCount: number;
  tradesPerDay: number;
  medianMinutesBetweenTrades: number;
  nightTradeRatio: number;
  lateMomentumEntryRatio: number;
  prematureExitRatio: number;
  rapidFlipRatio: number;
  rapidRotationRatio: number;
  postLossReentryCount: number;
  averageHoldingMinutes: number;
  medianHoldingMinutes: number;
  averageWinnerHoldMinutes: number;
  averageLoserHoldMinutes: number;
  positionSizeConsistency: number;
  tokenConcentration: number;
}

export type WalletKeyEventType =
  | "largest_gain"
  | "largest_loss"
  | "rapid_reversal"
  | "panic_exit"
  | "revenge_trade";

export interface WalletKeyEvent {
  type: WalletKeyEventType;
  timestamp: number;
  token: string;
  signature: string;
  tradeContext: string;
  interpretation: string;
}

export interface WalletProfile {
  personality: string;
  secondaryPersonality: string | null;
  modifiers: string[];
  behavioralSummary: string[];
  keyEvents: WalletKeyEvent[];
  tradingStyle: string;
  narrativeSummary: string;
  storyBeats: string[];
  metrics: WalletBehavioralMetrics;
}

export interface ReportAnalysisV2 {
  schemaVersion: "wallet-analysis.v1";
  generatedAt: string;
  engine: "v2" | "legacy-fallback";
  payload: WalletAnalysisResult;
}

export interface ReportDocument {
  jobId: string;
  wallet: string;
  rangeDays: number;
  subjectKind?: JobRequestKind;
  pricingMode?: CinemaPricingMode;
  visibility?: CinemaVisibility;
  experience?: CinemaExperience;
  moderationStatus?: ModerationStatus;
  creatorId?: string | null;
  creatorEmail?: string | null;
  subjectAddress?: string | null;
  subjectChain?: SupportedTokenChain | null;
  subjectName?: string | null;
  subjectSymbol?: string | null;
  subjectImage?: string | null;
  subjectDescription?: string | null;
  sourceMediaUrl?: string | null;
  sourceEmbedUrl?: string | null;
  sourceMediaProvider?: string | null;
  sourceTranscript?: string | null;
  stylePreset?: VideoStyleId | null;
  styleLabel?: string | null;
  durationSeconds?: number;
  audioEnabled?: boolean | null;
  storyCards?: StoryCard[];
  continuationPrompt?: string | null;
  tokenLinks?: TokenLink[];
  marketSnapshot?: TokenMarketSnapshot;
  pumpTokensTraded: number;
  buyCount: number;
  sellCount: number;
  solSpent: number;
  solReceived: number;
  estimatedPnlSol: number;
  bestTrade: string;
  worstTrade: string;
  styleClassification: string;
  summary: string;
  timeline: ReportTimelineItem[];
  downloadUrl: string | null;
  walletPersonality?: string;
  walletSecondaryPersonality?: string | null;
  walletModifiers?: string[];
  behaviorPatterns?: string[];
  memorableMoments?: string[];
  funObservations?: string[];
  narrativeSummary?: string;
  storyBeats?: string[];
  keyEvents?: WalletKeyEvent[];
  walletProfile?: WalletProfile;
  worldbuilder?: TianezhaWorldbuilderState | null;
  analysisV2?: ReportAnalysisV2;
}

export interface VideoDocument {
  jobId: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  renderStatus: "queued" | "processing" | "ready" | "failed";
}

export interface InternalVideoRenderDocument {
  id: string;
  jobId: string;
  status: "queued" | "processing" | "ready" | "failed";
  renderStatus: "queued" | "processing" | "ready" | "failed";
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PumpMetadataCacheDocument {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  description: string | null;
  cachedAt: string;
}

export interface PumpTrade {
  timestamp: number;
  signature: string;
  source: string;
  mint: string;
  symbol: string;
  name: string;
  image: string | null;
  side: "buy" | "sell";
  tokenAmount: number;
  solAmount: number;
}

export interface WalletStoryTokenMetadata {
  mint: string;
  symbol: string;
  name: string | null;
  imageUrl: string;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  solVolume: number;
  netSolFlow: number;
  firstSeenTimestamp: number;
  lastSeenTimestamp: number;
}

export interface WalletStory {
  wallet: string;
  storyKind?: JobRequestKind;
  pricingMode?: CinemaPricingMode;
  visibility?: CinemaVisibility;
  experience?: CinemaExperience;
  subjectAddress?: string;
  subjectChain?: SupportedTokenChain | null;
  subjectName?: string | null;
  subjectSymbol?: string | null;
  subjectImage?: string | null;
  subjectDescription?: string | null;
  sourceMediaUrl?: string | null;
  sourceEmbedUrl?: string | null;
  sourceMediaProvider?: string | null;
  sourceTranscript?: string | null;
  stylePreset?: VideoStyleId | null;
  styleLabel?: string | null;
  requestedPrompt?: string | null;
  audioEnabled?: boolean | null;
  storyCards?: StoryCard[];
  continuationPrompt?: string | null;
  tokenLinks?: TokenLink[];
  marketSnapshot?: TokenMarketSnapshot;
  rangeDays: number;
  packageType: PackageType;
  durationSeconds: number;
  analytics: {
    pumpTokensTraded: number;
    buyCount: number;
    sellCount: number;
    solSpent: number;
    solReceived: number;
    estimatedPnlSol: number;
    bestTrade: string;
    worstTrade: string;
    styleClassification: string;
  };
  timeline: ReportTimelineItem[];
  walletPersonality?: string;
  walletSecondaryPersonality?: string | null;
  walletModifiers?: string[];
  behaviorPatterns?: string[];
  memorableMoments?: string[];
  funObservations?: string[];
  narrativeSummary?: string;
  storyBeats?: string[];
  keyEvents?: WalletKeyEvent[];
  walletProfile?: WalletProfile;
  worldbuilder?: TianezhaWorldbuilderState | null;
  videoIdentitySheet?: VideoIdentitySheet;
  sceneStateSequence?: SceneState[];
  videoPromptSequence?: VideoPromptScene[];
  tokenMetadata?: WalletStoryTokenMetadata[];
}

export interface WalletPersonalization {
  walletPersonality: string;
  behaviorPatterns: string[];
  memorableMoments: string[];
  funObservations: string[];
  narrativeSummary: string;
  storyBeats: string[];
}

export interface CinematicScene {
  sceneNumber: number;
  visualPrompt: string;
  narration: string;
  durationSeconds: number;
  imageUrl: string | null;
  stateRef?: string;
  continuityNote?: string;
}

export interface GeneratedCinematicScript {
  hookLine: string;
  scenes: CinematicScene[];
}
