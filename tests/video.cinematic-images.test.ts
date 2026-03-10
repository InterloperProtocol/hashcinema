import { assignSceneImageUrls, buildPumpImageReferences } from "@/lib/ai/cinematic";
import { CinematicScene, WalletStory } from "@/lib/types/domain";

function createStory(): WalletStory {
  return {
    wallet: "wallet-test",
    rangeDays: 1,
    packageType: "1d",
    durationSeconds: 30,
    analytics: {
      pumpTokensTraded: 2,
      buyCount: 3,
      sellCount: 2,
      solSpent: 2.4,
      solReceived: 2.1,
      estimatedPnlSol: -0.3,
      bestTrade: "ABC (+0.2 SOL)",
      worstTrade: "XYZ (-0.4 SOL)",
      styleClassification: "Momentum",
    },
    timeline: [
      {
        timestamp: 100,
        signature: "sig-a-1",
        mint: "mint-a",
        symbol: "AAA",
        image: "https://cdn.example.com/a.png",
        side: "buy",
        tokenAmount: 10,
        solAmount: 0.5,
      },
      {
        timestamp: 110,
        signature: "sig-a-2",
        mint: "mint-a",
        symbol: "AAA",
        image: "https://cdn.example.com/a.png",
        side: "sell",
        tokenAmount: 5,
        solAmount: 0.4,
      },
      {
        timestamp: 120,
        signature: "sig-b-1",
        mint: "mint-b",
        symbol: "BBB",
        image: "https://cdn.example.com/b.png",
        side: "buy",
        tokenAmount: 9,
        solAmount: 0.8,
      },
    ],
  };
}

describe("cinematic image plumbing", () => {
  it("builds deduped pump image references ranked by trade density", () => {
    const references = buildPumpImageReferences(createStory());
    expect(references).toHaveLength(2);
    expect(references[0]?.mint).toBe("mint-a");
    expect(references[0]?.tradeCount).toBe(2);
    expect(references[1]?.mint).toBe("mint-b");
  });

  it("fills missing scene image urls using the available image pool", () => {
    const scenes: CinematicScene[] = [
      {
        sceneNumber: 1,
        visualPrompt: "Scene one",
        narration: "Narration one",
        durationSeconds: 8,
        imageUrl: null,
      },
      {
        sceneNumber: 2,
        visualPrompt: "Scene two",
        narration: "Narration two",
        durationSeconds: 9,
        imageUrl: "https://cdn.example.com/custom.png",
      },
      {
        sceneNumber: 3,
        visualPrompt: "Scene three",
        narration: "Narration three",
        durationSeconds: 13,
        imageUrl: null,
      },
    ];

    const result = assignSceneImageUrls(scenes, [
      "https://cdn.example.com/a.png",
      "https://cdn.example.com/b.png",
    ]);

    expect(result[0]?.imageUrl).toBe("https://cdn.example.com/a.png");
    expect(result[1]?.imageUrl).toBe("https://cdn.example.com/custom.png");
    expect(result[2]?.imageUrl).toBe("https://cdn.example.com/a.png");
  });

  it("normalizes invalid urls to null when no pool is available", () => {
    const scenes: CinematicScene[] = [
      {
        sceneNumber: 1,
        visualPrompt: "Scene one",
        narration: "Narration one",
        durationSeconds: 10,
        imageUrl: "not-a-url",
      },
    ];

    const result = assignSceneImageUrls(scenes, []);
    expect(result[0]?.imageUrl).toBeNull();
  });
});
