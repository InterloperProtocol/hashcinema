import { round } from "@/lib/utils";
import { GeneratedCinematicScript, WalletStory } from "@/lib/types/domain";

export interface VeoTokenMetadata {
  mint: string;
  symbol: string;
  name: string | null;
  imageUrl: string;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  solVolume: number;
  lastSeenTimestamp: number;
}

export interface GoogleVeoRenderPayload {
  provider: "google_veo";
  model: string;
  prompt: string;
  styleHints: string[];
  tokenMetadata: VeoTokenMetadata[];
  sceneMetadata: Array<{
    sceneNumber: number;
    durationSeconds: number;
    narration: string;
    visualPrompt: string;
    imageUrl: string | null;
  }>;
  storyMetadata: {
    wallet: string;
    rangeDays: number;
    packageType: WalletStory["packageType"];
    durationSeconds: number;
    analytics: WalletStory["analytics"];
  };
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildTokenMetadata(story: WalletStory): VeoTokenMetadata[] {
  const byMint = new Map<string, VeoTokenMetadata>();

  for (const item of story.timeline) {
    if (!isHttpUrl(item.image)) {
      continue;
    }

    const current = byMint.get(item.mint);
    if (current) {
      current.tradeCount += 1;
      if (item.side === "buy") current.buyCount += 1;
      if (item.side === "sell") current.sellCount += 1;
      current.solVolume = round(current.solVolume + item.solAmount, 6);
      current.lastSeenTimestamp = Math.max(current.lastSeenTimestamp, item.timestamp);
      continue;
    }

    byMint.set(item.mint, {
      mint: item.mint,
      symbol: item.symbol,
      name: item.name ?? null,
      imageUrl: item.image,
      tradeCount: 1,
      buyCount: item.side === "buy" ? 1 : 0,
      sellCount: item.side === "sell" ? 1 : 0,
      solVolume: round(item.solAmount, 6),
      lastSeenTimestamp: item.timestamp,
    });
  }

  return [...byMint.values()]
    .sort((a, b) => {
      if (b.tradeCount !== a.tradeCount) {
        return b.tradeCount - a.tradeCount;
      }
      return b.solVolume - a.solVolume;
    })
    .slice(0, 8);
}

function buildPrompt(input: {
  story: WalletStory;
  script: GeneratedCinematicScript;
  tokenMetadata: VeoTokenMetadata[];
}): string {
  const walletShort = `${input.story.wallet.slice(0, 4)}...${input.story.wallet.slice(-4)}`;
  const tokenRefs = input.tokenMetadata
    .map(
      (token) =>
        `${token.symbol}(${token.tradeCount} trades, ${token.solVolume} SOL volume, image=${token.imageUrl})`,
    )
    .join("; ");

  const sceneLines = input.script.scenes
    .map(
      (scene) =>
        `Scene ${scene.sceneNumber} (${scene.durationSeconds}s) | visual="${scene.visualPrompt}" | narration="${scene.narration}" | image=${scene.imageUrl ?? "none"}`,
    )
    .join("\n");

  return [
    "Create a fast-paced, funny-memetic cinematic wallet recap with coherent scene transitions.",
    `Wallet: ${walletShort}, package=${input.story.packageType}, duration=${input.story.durationSeconds}s.`,
    `Facts to preserve: buys=${input.story.analytics.buyCount}, sells=${input.story.analytics.sellCount}, spent=${input.story.analytics.solSpent} SOL, received=${input.story.analytics.solReceived} SOL, pnl=${input.story.analytics.estimatedPnlSol} SOL.`,
    `Hook line: ${input.script.hookLine}`,
    `Token media references (prioritize these image assets): ${tokenRefs || "none provided"}.`,
    "Use captions and kinetic motion graphics that match narration timing without fabricating extra trades.",
    "Keep the tone satirical and internet-native, but avoid defamation and unsafe content.",
    "Scene plan:",
    sceneLines,
  ].join("\n");
}

export function buildGoogleVeoRenderPayload(input: {
  walletStory: WalletStory;
  script: GeneratedCinematicScript;
  model?: string;
}): GoogleVeoRenderPayload {
  const tokenMetadata = buildTokenMetadata(input.walletStory);

  return {
    provider: "google_veo",
    model: input.model ?? "veo-3",
    prompt: buildPrompt({
      story: input.walletStory,
      script: input.script,
      tokenMetadata,
    }),
    styleHints: [
      "memetic",
      "cinematic",
      "high-energy-edit",
      "captioned",
      "satirical",
    ],
    tokenMetadata,
    sceneMetadata: input.script.scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      durationSeconds: scene.durationSeconds,
      narration: scene.narration,
      visualPrompt: scene.visualPrompt,
      imageUrl: scene.imageUrl,
    })),
    storyMetadata: {
      wallet: input.walletStory.wallet,
      rangeDays: input.walletStory.rangeDays,
      packageType: input.walletStory.packageType,
      durationSeconds: input.walletStory.durationSeconds,
      analytics: input.walletStory.analytics,
    },
  };
}
