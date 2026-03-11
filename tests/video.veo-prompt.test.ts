import { buildGoogleVeoRenderPayload } from "@/lib/video/veo";
import { GeneratedCinematicScript, WalletStory } from "@/lib/types/domain";

function buildStory(): WalletStory {
  return {
    wallet: "8BfH8gV3yZ7d1kY9uJvB3DhR6yQ2pM8P2a8s9s4s4s4s",
    rangeDays: 2,
    packageType: "2d",
    durationSeconds: 60,
    analytics: {
      pumpTokensTraded: 2,
      buyCount: 3,
      sellCount: 2,
      solSpent: 4.8,
      solReceived: 4.1,
      estimatedPnlSol: -0.7,
      bestTrade: "AAA (+0.21 SOL)",
      worstTrade: "BBB (-0.62 SOL)",
      styleClassification: "The Chaos Gambler",
    },
    walletPersonality: "The Chaos Gambler",
    walletSecondaryPersonality: "The Momentum Chaser",
    walletModifiers: ["Maximum Hopium", "Revenge Entry Specialist"],
    behaviorPatterns: [
      "Rapid rotations into fresh pumps",
      "Late entries after first candle extensions",
      "Re-entry behavior after losses",
    ],
    narrativeSummary:
      "The wallet sprinted into momentum names, took fast cuts, and kept reloading for a comeback arc.",
    keyEvents: [
      {
        type: "largest_gain",
        timestamp: 220,
        token: "AAA",
        signature: "sig-2",
        tradeContext: "Quick reclaim after first shakeout",
        interpretation: "Confidence spike converted into realized upside.",
      },
    ],
    timeline: [
      {
        timestamp: 100,
        signature: "sig-1",
        mint: "mint-a",
        symbol: "AAA",
        name: "Alpha",
        image: "https://cdn.example.com/a.png",
        side: "buy",
        tokenAmount: 1000,
        solAmount: 1.2,
      },
      {
        timestamp: 200,
        signature: "sig-2",
        mint: "mint-a",
        symbol: "AAA",
        name: "Alpha",
        image: "https://cdn.example.com/a.png",
        side: "sell",
        tokenAmount: 800,
        solAmount: 1.0,
      },
      {
        timestamp: 300,
        signature: "sig-3",
        mint: "mint-b",
        symbol: "BBB",
        name: "Beta",
        image: "https://cdn.example.com/b.png",
        side: "buy",
        tokenAmount: 700,
        solAmount: 1.9,
      },
    ],
  };
}

function buildScript(): GeneratedCinematicScript {
  return {
    hookLine: "Wallet woke up and chose velocity.",
    scenes: [
      {
        sceneNumber: 1,
        visualPrompt: "Fast montage of chart candles and meme overlays",
        narration: "The session opened with immediate high-tempo entries.",
        durationSeconds: 20,
        imageUrl: "https://cdn.example.com/a.png",
      },
      {
        sceneNumber: 2,
        visualPrompt: "Volatile middle act with rapid position changes",
        narration: "Momentum rotated and conviction got stress-tested.",
        durationSeconds: 20,
        imageUrl: "https://cdn.example.com/b.png",
      },
      {
        sceneNumber: 3,
        visualPrompt: "Final scoreboard reveal with satirical captions",
        narration: "Credits rolled with meme energy and a hard lesson.",
        durationSeconds: 20,
        imageUrl: null,
      },
    ],
  };
}

describe("google veo prompt engine", () => {
  it("builds prompt + structured metadata payload from wallet story and script", () => {
    const payload = buildGoogleVeoRenderPayload({
      walletStory: buildStory(),
      script: buildScript(),
      model: "veo-3.1-fast-generate-001",
      resolution: "1080p",
    });

    expect(payload.provider).toBe("google_veo");
    expect(payload.model).toBe("veo-3.1-fast-generate-001");
    expect(payload.resolution).toBe("1080p");
    expect(payload.generateAudio).toBe(true);
    expect(payload.tokenMetadata).toHaveLength(2);
    expect(payload.tokenMetadata.map((item) => item.mint).sort()).toEqual([
      "mint-a",
      "mint-b",
    ]);
    expect(payload.sceneMetadata).toHaveLength(3);
    expect(payload.prompt.includes("Hook line")).toBe(true);
    expect(payload.prompt.includes("Wallet woke up and chose velocity.")).toBe(true);
    expect(payload.prompt.includes("AAA")).toBe(true);
    expect(payload.prompt.includes("Wallet personality profile: The Chaos Gambler + The Momentum Chaser.")).toBe(true);
    expect(payload.prompt.includes("Scene image rule:")).toBe(true);
    expect(payload.prompt.includes("Hard constraints:")).toBe(true);
  });
});
