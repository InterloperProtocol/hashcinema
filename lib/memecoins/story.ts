import { JobDocument, ReportDocument, WalletStory } from "@/lib/types/domain";

import { ResolvedMemecoinMetadata } from "@/lib/memecoins/metadata";
import { getTokenVideoStylePreset } from "@/lib/memecoins/styles";

function formatUsdCompact(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 2,
    style: "currency",
    currency: "USD",
  }).format(value);
}

function chainLabel(chain: ResolvedMemecoinMetadata["chain"]): string {
  switch (chain) {
    case "solana":
      return "Solana";
    case "ethereum":
      return "Ethereum";
    case "bsc":
      return "BNB Chain";
    case "base":
      return "Base";
  }
}

function createPlaceholderImage(symbol: string): string {
  return `https://placehold.co/1024x1024/101318/98c8bf/png?text=${encodeURIComponent(symbol)}`;
}

function buildNarrative(input: {
  token: ResolvedMemecoinMetadata;
  userPrompt: string | null;
  styleLabel: string;
  durationSeconds: number;
}): string {
  const parts = [
    `${input.token.name} (${input.token.symbol}) gets treated like the protagonist of a ${input.durationSeconds}-second ${input.styleLabel} memecoin trailer.`,
    `${chainLabel(input.token.chain)} is the stage, and the address itself is the immutable identity anchor.`,
    input.token.description
      ? `Core brief: ${input.token.description.trim()}`
      : "Core brief: lean into the token's iconography, community energy, and launch aura.",
    input.userPrompt
      ? `User direction: ${input.userPrompt.trim()}`
      : "User direction: keep the cut short, stylish, and built for sharing.",
  ];

  return parts.join(" ");
}

function buildStoryBeats(input: {
  token: ResolvedMemecoinMetadata;
  styleLabel: string;
  durationSeconds: number;
}): string[] {
  const { token } = input;
  const beats = [
    `${token.symbol} enters as a ${chainLabel(token.chain)} memecoin signal, not a spreadsheet.`,
    `Show the token identity, logo energy, and ticker recognition before any market overlays.`,
    `Escalate into a ${input.styleLabel.toLowerCase()} middle act with motion around the contract address and live market aura.`,
    `Land on a final collectible-card style frame that makes the viewer want to share the token, not read a report.`,
  ];

  if (token.isPump) {
    beats.splice(1, 0, "Acknowledge the Pump launch origin and treat it like a native trench event.");
  }

  return beats.slice(0, input.durationSeconds >= 60 ? 4 : 3);
}

function buildBehaviorPatterns(token: ResolvedMemecoinMetadata): string[] {
  const patterns = [
    `${chainLabel(token.chain)} token-first presentation with no wallet-recap framing.`,
    "Visual emphasis stays on symbol recognition, imagery, and shareable positioning.",
  ];

  if (token.marketSnapshot.liquidityUsd) {
    patterns.push(
      `Liquidity signal currently reads ${formatUsdCompact(token.marketSnapshot.liquidityUsd)}.`,
    );
  }

  if (token.marketSnapshot.volume24hUsd) {
    patterns.push(
      `24h velocity lands around ${formatUsdCompact(token.marketSnapshot.volume24hUsd)} of volume.`,
    );
  }

  return patterns;
}

function buildFunObservations(token: ResolvedMemecoinMetadata): string[] {
  const lines = [
    `${token.symbol} is being framed as media IP first and token metadata second.`,
    "The contract address becomes a collectible identity stamp instead of a back-office detail.",
  ];

  if (token.isPump) {
    lines.push("Pump-native metadata gives the trailer a cleaner launch identity out of the gate.");
  }

  if (token.marketSnapshot.marketCapUsd) {
    lines.push(`Market cap snapshot clocks in near ${formatUsdCompact(token.marketSnapshot.marketCapUsd)}.`);
  }

  return lines.slice(0, 3);
}

function buildMemorableMoments(token: ResolvedMemecoinMetadata): string[] {
  const moments = [
    `${token.symbol} gets its own hero intro instead of sharing screen time with unrelated wallet history.`,
    `The ${chainLabel(token.chain)} chain badge and token symbol stay readable enough to function as a moving trading card.`,
  ];

  if (token.marketSnapshot.pairUrl) {
    moments.push("The final frame can hand off directly into the live DexScreener pair.");
  }

  return moments.slice(0, 3);
}

function bestTradeLabel(token: ResolvedMemecoinMetadata): string {
  if (token.marketSnapshot.marketCapUsd) {
    return `Market cap snapshot ${formatUsdCompact(token.marketSnapshot.marketCapUsd)}`;
  }

  return `${token.symbol} identity reveal`;
}

function worstTradeLabel(token: ResolvedMemecoinMetadata): string {
  if (token.marketSnapshot.liquidityUsd) {
    return `Liquidity snapshot ${formatUsdCompact(token.marketSnapshot.liquidityUsd)}`;
  }

  return "Thin metadata surface";
}

export function buildTokenVideoArtifacts(input: {
  job: JobDocument;
  token: ResolvedMemecoinMetadata;
}): {
  report: Omit<ReportDocument, "summary" | "downloadUrl">;
  story: WalletStory;
} {
  const style = getTokenVideoStylePreset(input.job.stylePreset);
  const narrativeSummary = buildNarrative({
    token: input.token,
    userPrompt: input.job.requestedPrompt ?? null,
    styleLabel: style.label,
    durationSeconds: input.job.videoSeconds,
  });
  const storyBeats = buildStoryBeats({
    token: input.token,
    styleLabel: style.label,
    durationSeconds: input.job.videoSeconds,
  });
  const behaviorPatterns = buildBehaviorPatterns(input.token);
  const funObservations = buildFunObservations(input.token);
  const memorableMoments = buildMemorableMoments(input.token);
  const imageUrl = input.token.image ?? createPlaceholderImage(input.token.symbol);

  const story: WalletStory = {
    wallet: input.token.address,
    storyKind: "token_video",
    subjectAddress: input.token.address,
    subjectChain: input.token.chain,
    subjectName: input.token.name,
    subjectSymbol: input.token.symbol,
    subjectImage: input.token.image,
    subjectDescription: input.token.description,
    stylePreset: style.id,
    styleLabel: style.label,
    requestedPrompt: input.job.requestedPrompt ?? null,
    tokenLinks: input.token.links,
    marketSnapshot: input.token.marketSnapshot,
    rangeDays: input.job.rangeDays,
    packageType: input.job.packageType,
    durationSeconds: input.job.videoSeconds,
    analytics: {
      pumpTokensTraded: 1,
      buyCount: 0,
      sellCount: 0,
      solSpent: 0,
      solReceived: 0,
      estimatedPnlSol: 0,
      bestTrade: bestTradeLabel(input.token),
      worstTrade: worstTradeLabel(input.token),
      styleClassification: style.label,
    },
    timeline: [],
    walletPersonality: `${input.token.symbol} signal protagonist`,
    behaviorPatterns,
    memorableMoments,
    funObservations,
    narrativeSummary,
    storyBeats,
    tokenMetadata: [
      {
        mint: input.token.address,
        symbol: input.token.symbol,
        name: input.token.name,
        imageUrl,
        tradeCount: 1,
        buyCount: 0,
        sellCount: 0,
        solVolume: 0,
        netSolFlow: 0,
        firstSeenTimestamp: Date.now(),
        lastSeenTimestamp: Date.now(),
      },
    ],
  };

  const report: Omit<ReportDocument, "summary" | "downloadUrl"> = {
    jobId: input.job.jobId,
    wallet: input.token.address,
    rangeDays: input.job.rangeDays,
    subjectKind: "token_video",
    subjectAddress: input.token.address,
    subjectChain: input.token.chain,
    subjectName: input.token.name,
    subjectSymbol: input.token.symbol,
    subjectImage: input.token.image,
    subjectDescription: input.token.description,
    stylePreset: style.id,
    styleLabel: style.label,
    durationSeconds: input.job.videoSeconds,
    tokenLinks: input.token.links,
    marketSnapshot: input.token.marketSnapshot,
    pumpTokensTraded: 1,
    buyCount: 0,
    sellCount: 0,
    solSpent: 0,
    solReceived: 0,
    estimatedPnlSol: 0,
    bestTrade: bestTradeLabel(input.token),
    worstTrade: worstTradeLabel(input.token),
    styleClassification: style.label,
    timeline: [],
    walletPersonality: `${input.token.symbol} signal protagonist`,
    behaviorPatterns,
    memorableMoments,
    funObservations,
    narrativeSummary,
    storyBeats,
  };

  return {
    report,
    story,
  };
}
