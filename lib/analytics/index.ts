/**
 * HASHCINEMA Analytics Integration Notes
 *
 * Usage:
 *   import { analyzeWalletProfile } from "@/lib/analytics";
 *   const result = await analyzeWalletProfile({ wallet, rangeHours: 24 });
 *
 * The module is intentionally isolated from the existing report/video pipeline so it can be
 * adopted incrementally. It reuses the repo's Helius + Pump filtering modules and validates
 * final output with Zod before returning.
 */

import { PublicKey } from "@solana/web3.js";
import { SEED_WALLET_PROFILES } from "./constants";
import { fetchWalletActivity } from "./fetchWalletActivity";
import { filterPumpActivity } from "./filterPumpActivity";
import { generateStoryBeats } from "./generateStoryBeats";
import { loadWritersRoomContent } from "./loadWritersRoomContent";
import { normalizeTrades } from "./normalizeTrades";
import {
  analyzeWalletProfileInputSchema,
  walletAnalysisResultSchema,
} from "./schemas";
import { selectInterpretationLines } from "./selectInterpretationLines";
import { selectMoments } from "./selectMoments";
import { selectNarratives } from "./selectNarratives";
import { scoreMetrics } from "./scoreMetrics";
import { scoreModifiers } from "./scoreModifiers";
import { scorePersonality } from "./scorePersonality";
import {
  AnalyzeWalletProfileInput,
  AnalysisRangeHours,
  NormalizedTrade,
  SeedWalletBehaviorProfile,
  SeedWalletProfileId,
  WalletAnalysisResult,
} from "./types";

function assertValidWallet(wallet: string): void {
  try {
    new PublicKey(wallet);
  } catch {
    throw new Error("Invalid Solana wallet address");
  }
}

async function analyzeFromNormalizedTrades(input: {
  wallet: string;
  rangeHours: AnalysisRangeHours;
  normalizedTrades: NormalizedTrade[];
}): Promise<WalletAnalysisResult> {
  const metrics = scoreMetrics({
    normalizedTrades: input.normalizedTrades,
    rangeHours: input.rangeHours,
  });

  const personality = scorePersonality({ metrics });
  const modifiers = scoreModifiers({ metrics });
  const moments = selectMoments({
    normalizedTrades: input.normalizedTrades,
    metrics,
  });

  const writersRoom = await loadWritersRoomContent();
  const interpretationSelection = selectInterpretationLines({
    metrics,
    personality,
    modifiers,
    moments,
    writersRoom,
  });

  const narratives = selectNarratives({
    wallet: input.wallet,
    rangeHours: input.rangeHours,
    metrics,
    personality,
    modifiers,
    moments,
    interpretationSelection,
    writersRoom,
  });

  const storyBeats = generateStoryBeats({
    wallet: input.wallet,
    rangeHours: input.rangeHours,
    metrics,
    personality,
    modifiers,
    moments,
  });

  const result: WalletAnalysisResult = {
    wallet: input.wallet,
    rangeHours: input.rangeHours,
    normalizedTrades: input.normalizedTrades,
    metrics,
    personality,
    modifiers,
    interpretationLines: interpretationSelection.lines,
    moments,
    walletVibeCheck: narratives.walletVibeCheck,
    cinematicSummary: narratives.cinematicSummary,
    xReadyLines: narratives.xReadyLines,
    storyBeats,
    writersRoomSelections: narratives.writersRoomSelections,
  };

  return walletAnalysisResultSchema.parse(result);
}

export async function analyzeWalletProfile(
  input: AnalyzeWalletProfileInput,
): Promise<WalletAnalysisResult> {
  const parsed = analyzeWalletProfileInputSchema.parse(input);
  assertValidWallet(parsed.wallet);

  const transactions = await fetchWalletActivity({
    wallet: parsed.wallet,
    rangeHours: parsed.rangeHours,
  });

  const pumpTrades = await filterPumpActivity({
    wallet: parsed.wallet,
    transactions,
  });

  const normalizedTrades = normalizeTrades(pumpTrades);

  return analyzeFromNormalizedTrades({
    wallet: parsed.wallet,
    rangeHours: parsed.rangeHours,
    normalizedTrades,
  });
}

export function getSeedWalletProfiles(): SeedWalletBehaviorProfile[] {
  return SEED_WALLET_PROFILES;
}

export async function analyzeSeedWalletProfile(
  seedId: SeedWalletProfileId,
): Promise<WalletAnalysisResult> {
  const profile = SEED_WALLET_PROFILES.find((candidate) => candidate.id === seedId);
  if (!profile) {
    throw new Error(`Seed profile not found: ${seedId}`);
  }

  return analyzeFromNormalizedTrades({
    wallet: profile.wallet,
    rangeHours: profile.rangeHours,
    normalizedTrades: profile.normalizedTrades,
  });
}

export type {
  AnalyzeWalletProfileInput,
  WalletAnalysisResult,
  SeedWalletBehaviorProfile,
  SeedWalletProfileId,
} from "./types";
