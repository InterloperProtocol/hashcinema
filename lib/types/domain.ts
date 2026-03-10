import type { WalletAnalysisResult } from "@/lib/analytics/types";

export type PackageType = "1d" | "2d" | "3d";

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
  videoSeconds: number;
}

export interface JobDocument {
  jobId: string;
  wallet: string;
  packageType: PackageType;
  rangeDays: number;
  priceSol: number;
  videoSeconds: number;
  status: JobStatus;
  progress: JobProgress;
  txSignature: string | null;
  createdAt: string;
  updatedAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  requiredLamports: number;
  receivedLamports: number;
  paymentSignatures: string[];
  lastPaymentAt: string | null;
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
  analysisV2?: ReportAnalysisV2;
}

export interface VideoDocument {
  jobId: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  renderStatus: "queued" | "processing" | "ready" | "failed";
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

export interface WalletStory {
  wallet: string;
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
}

export interface GeneratedCinematicScript {
  hookLine: string;
  scenes: CinematicScene[];
}
