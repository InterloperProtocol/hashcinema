import { buildGoogleVeoRenderPayload } from "@/lib/video/veo";
import { GeneratedCinematicScript, WalletStory } from "@/lib/types/domain";
import { buildTianezhaWorldbuilder } from "@/lib/worldbuilder/tianezha";

function buildStory(overrides: Partial<WalletStory> = {}): WalletStory {
  return {
    wallet: "8BfH8gV3yZ7d1kY9uJvB3DhR6yQ2pM8P2a8s9s4s4s4s",
    storyKind: "token_video",
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
    videoPromptSequence: [
      {
        sceneNumber: 1,
        phase: "opening",
        narrativePurpose: "Introduce the wallet and pace.",
        shotType: "wide shot",
        cameraMovement: "slow push-in",
        environment: "dark room with chart screens",
        characterAction: "trader locks in on the first setup",
        visualStyle: "hyperreal meme cinema",
        lighting: "cold blue and green screen glow",
        soundDesign: "low synth and keyboard clicks",
        symbolicVisuals: ["neon trading screens", "glowing chart lines"],
        narrationHook: "The session opened with immediate high-tempo entries.",
        stateRef: "identity-1-state-1",
        continuityAnchors: [
          "hooded memecoin gambler in a room full of dangerous optimism",
          "casino-cathedral tension",
          "AAA remains the recurring token anchor",
        ],
        continuityNote:
          "Preserve the hooded memecoin gambler and keep AAA readable in the same casino-cathedral frame.",
        providerPrompts: {
          veo: "Wide shot in a dark room with chart screens. Camera movement: slow push-in.",
          runway: "Stylized opening in a dark room with chart screens.",
          kling: "Cinematic opening in a dark room with chart screens.",
        },
      },
      {
        sceneNumber: 2,
        phase: "climax",
        narrativePurpose: "Land the most watchable moment.",
        shotType: "hero shot",
        cameraMovement: "hard snap zoom",
        environment: "market arena exploding in particles",
        characterAction: "PnL collides with token symbols in the final set piece",
        visualStyle: "epic trailer payoff",
        lighting: "green-white burst",
        soundDesign: "orchestral rise and electronic impact",
        symbolicVisuals: ["rocket launches", "green particles exploding into red static"],
        narrationHook: "Credits rolled with meme energy and a hard lesson.",
        stateRef: "identity-1-state-2",
        continuityAnchors: [
          "hooded memecoin gambler in a room full of dangerous optimism",
          "casino-cathedral tension",
          "AAA remains the recurring token anchor",
        ],
        continuityNote:
          "Keep the same protagonist and token anchor alive as the scene escalates into the climax.",
        providerPrompts: {
          veo: "Hero shot in a market arena exploding in particles. Camera movement: hard snap zoom.",
          runway: "Stylized climax in a market arena exploding in particles.",
          kling: "Cinematic climax in a market arena exploding in particles.",
        },
      },
    ],
    videoIdentitySheet: {
      identityId: "identity-1",
      archetype: "The Gambler",
      protagonist: "hooded memecoin gambler in a room full of dangerous optimism",
      paletteCanon: ["neon green", "warning red", "casino gold"],
      worldCanon: ["casino-cathedral tension", "dark trading room noir", "dashboard skyline"],
      lightingCanon: ["hard chart glow", "green-red contrast", "smoky backlight"],
      symbolCanon: ["glowing chart lines", "neon trading screens", "AAA shrine iconography"],
      tokenAnchors: [
        {
          mint: "mint-a",
          symbol: "AAA",
          name: "Alpha",
          imageUrl: "https://cdn.example.com/a.png",
          role: "primary",
        },
      ],
      negativeConstraints: [
        "Do not replace the protagonist with abstract charts only.",
        "Do not invent new tokens, fake dashboards, or stat overlays.",
      ],
    },
    sceneStateSequence: [
      {
        sceneNumber: 1,
        phase: "opening",
        stateRef: "identity-1-state-1",
        emotionVector: {
          confidence: 0.62,
          chaos: 0.54,
          desperation: 0.38,
          discipline: 0.56,
          luck: 0.51,
          intensity: 0.54,
        },
        subjectFocus: "introduce AAA as the first signal in the room",
        continuityAnchors: [
          "hooded memecoin gambler in a room full of dangerous optimism",
          "casino-cathedral tension",
          "AAA remains the recurring token anchor",
        ],
        deltaFromPrevious: ["establish the identity sheet before any drift is allowed"],
        transitionNote:
          "Opening phase pushes focus toward introduce aaa as the first signal in the room while establish the identity sheet before any drift is allowed.",
      },
      {
        sceneNumber: 2,
        phase: "climax",
        stateRef: "identity-1-state-2",
        emotionVector: {
          confidence: 0.67,
          chaos: 0.73,
          desperation: 0.48,
          discipline: 0.42,
          luck: 0.57,
          intensity: 0.61,
        },
        subjectFocus: "AAA turns into the poster image of the session",
        continuityAnchors: [
          "hooded memecoin gambler in a room full of dangerous optimism",
          "casino-cathedral tension",
          "AAA remains the recurring token anchor",
        ],
        deltaFromPrevious: ["chaos rises", "discipline cools"],
        transitionNote:
          "Climax phase pushes focus toward aaa turns into the poster image of the session while chaos rises, discipline cools.",
      },
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
    ...overrides,
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
      walletStory: buildStory({
        audioEnabled: true,
      }),
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
    expect(payload.sceneMetadata[0]?.stateRef).toBe("identity-1-scene-1");
    expect(payload.sceneMetadata[0]?.continuityAnchors?.length).toBeGreaterThan(0);
    expect(payload.sceneMetadata[0]?.continuityPrompt).toContain("Preserve");
    expect(payload.coherence?.identity.identityId).toBe("identity-1");
    expect(payload.coherence?.sceneStates).toHaveLength(3);
    expect(payload.prompt.includes("Trailer hook:")).toBe(true);
    expect(payload.prompt.includes("Wallet woke up and chose velocity.")).toBe(true);
    expect(payload.prompt.includes("AAA")).toBe(true);
    expect(payload.prompt.includes("Identity bible:")).toBe(true);
    expect(payload.prompt.includes("Archetype: The Gambler.")).toBe(true);
    expect(payload.prompt.includes("Sound bible:")).toBe(true);
    expect(payload.prompt.includes("Scene sound reel:")).toBe(true);
    expect(payload.prompt.includes("State transition reel:")).toBe(true);
    expect(payload.prompt.includes("Scene realization reel:")).toBe(true);
    expect(payload.prompt.includes("stateRef=identity-1-scene-1")).toBe(true);
    expect(payload.prompt.includes("Token image anchors:")).toBe(true);
    expect(payload.prompt.includes("Hard constraints:")).toBe(true);
    expect(payload.prompt.includes("This is cinema, not analytics.")).toBe(true);
    expect(payload.prompt.includes("4.8 SOL")).toBe(false);
    expect(payload.prompt.includes("0.21 SOL")).toBe(false);
  });

  it("keeps token-video renders silent unless audio is explicitly enabled", () => {
    const payload = buildGoogleVeoRenderPayload({
      walletStory: buildStory({
        audioEnabled: undefined,
      }),
      script: buildScript(),
    });

    expect(payload.generateAudio).toBe(false);
  });

  it("defaults bedtime stories to audio-on even when no override is provided", () => {
    const payload = buildGoogleVeoRenderPayload({
      walletStory: buildStory({
        storyKind: "bedtime_story",
        audioEnabled: undefined,
      }),
      script: buildScript(),
    });

    expect(payload.generateAudio).toBe(true);
    expect(payload.styleHints).toContain("bedtime");
  });

  it("builds a trailer-first music video prompt with mode-specific audio guidance", () => {
    const payload = buildGoogleVeoRenderPayload({
      walletStory: buildStory({
        storyKind: "music_video",
        subjectName: "Neon Anthem",
        subjectDescription: "A synthwave single gets trailer treatment.",
        requestedPrompt: "Make the chorus feel enormous.",
        audioEnabled: undefined,
      }),
      script: buildScript(),
    });

    expect(payload.generateAudio).toBe(true);
    expect(payload.styleHints).toEqual(
      expect.arrayContaining([
        "music-video",
        "chorus-led",
        "performance-first",
        "beat-synced",
      ]),
    );
    expect(payload.prompt).toContain("Build a trailer-first music video.");
    expect(payload.prompt).toContain(
      "Audio is enabled. Follow the lyrics, beat, chorus, and musical dynamics without inventing new song facts.",
    );
    expect(payload.prompt.includes("This is cinema, not analytics.")).toBe(false);
  });

  it("builds a scene recreation prompt with source-faithful continuity guidance", () => {
    const payload = buildGoogleVeoRenderPayload({
      walletStory: buildStory({
        storyKind: "scene_recreation",
        subjectName: "The Last Scene",
        subjectDescription: "A source scene gets rebuilt at higher voltage.",
        requestedPrompt: "Preserve the blocking and dialogue cadence.",
        audioEnabled: true,
      }),
      script: buildScript(),
    });

    expect(payload.generateAudio).toBe(true);
    expect(payload.styleHints).toEqual(
      expect.arrayContaining([
        "scene-recreation",
        "dialogue-led",
        "continuity-first",
        "source-faithful",
      ]),
    );
    expect(payload.prompt).toContain("Build a trailer-grade scene recreation.");
    expect(payload.prompt).toContain(
      "Audio is enabled. Preserve the dialogue cadence and source-scene timing without inventing new quotes.",
    );
    expect(payload.prompt.includes("This is cinema, not analytics.")).toBe(false);
  });

  it("forces source-linked music videos to stay silent and carry worldbuilder context", () => {
    const youtubeUrl = "https://www.youtube.com/watch?v=e5nyQmaq4k4";
    const payload = buildGoogleVeoRenderPayload({
      walletStory: buildStory({
        storyKind: "music_video",
        subjectName: "Neon Anthem",
        subjectDescription: "A synthwave single gets trailer treatment.",
        requestedPrompt: "Make the chorus feel enormous.",
        sourceMediaUrl: youtubeUrl,
        sourceTranscript: "1 - Open on the hook.\n2 - Ride the beat.",
        worldbuilder: buildTianezhaWorldbuilder({
          storyKind: "music_video",
          subjectName: "Neon Anthem",
          subjectDescription: "A synthwave single gets trailer treatment.",
          requestedPrompt: "Make the chorus feel enormous.",
          sourceMediaUrl: youtubeUrl,
          sourceTranscript: "1 - Open on the hook.\n2 - Ride the beat.",
          audioEnabled: true,
        }),
        audioEnabled: true,
      }),
      script: buildScript(),
    });

    expect(payload.generateAudio).toBe(false);
    expect(payload.storyMetadata.audioEnabled).toBe(false);
    expect(payload.storyMetadata.sourceMediaProvider).toBe("youtube");
    expect(payload.storyMetadata.sourceMediaUrl).toBe(youtubeUrl);
    expect(payload.storyMetadata.worldbuilder?.knowledgeBase).toEqual(
      expect.arrayContaining([
        "poly-manifold: manifold optimization, Euclidean geometry, Sphere, and SPD constraints",
        "Awesome Physics Cognition-based Video Generation: physics-aware video generation survey and world-model map",
        "NewtonGen: controllable text-to-video with Newtonian dynamics and motion control",
      ]),
    );
    expect(payload.styleHints).toEqual(
      expect.arrayContaining([
        "source-linked",
        "external-audio",
        "source-transcript-aware",
        "music-video",
      ]),
    );
    expect(payload.prompt).toContain(
      "Audio is disabled for generation. Keep the render silent so the external track or lyric spine can be stitched in later.",
    );
    expect(payload.prompt).toContain(
      "Source context: youtube source is canonical. Keep the generation silent so the external track can be stitched later.",
    );
    expect(payload.prompt).toContain("Worldbuilder: tianezha /");
    expect(payload.prompt).toContain("Source transcript spine: 1 - Open on the hook.");
    expect(payload.prompt.includes(youtubeUrl)).toBe(false);
  });

  it("redacts URL-heavy creative briefs before they reach the Veo prompt", () => {
    const youtubeUrl = "https://www.youtube.com/watch?v=e5nyQmaq4k4";
    const payload = buildGoogleVeoRenderPayload({
      walletStory: buildStory({
        storyKind: "scene_recreation",
        subjectName: youtubeUrl,
        subjectDescription: `bitconnect edm remix\n${youtubeUrl}`,
        requestedPrompt: `Lyrics or song notes: ${youtubeUrl}`,
        audioEnabled: true,
      }),
      script: buildScript(),
    });

    expect(payload.prompt).toContain("the supplied source scene");
    expect(payload.prompt).toContain(
      "Use the supplied source scene as the main source of truth.",
    );
    expect(payload.prompt).toContain(
      "Preserve the source scene's emotional spine, blocking, and timing without quoting external links or lyrics.",
    );
    expect(payload.prompt.includes(youtubeUrl)).toBe(false);
    expect(payload.prompt.includes("bitconnect edm remix")).toBe(false);
    expect(payload.prompt.includes("Lyrics or song notes")).toBe(false);
  });
});
