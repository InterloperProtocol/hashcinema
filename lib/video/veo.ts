import {
  alignSceneStatesToCount,
  buildSceneContinuityPrompt,
} from "@/lib/analytics/videoCoherence";
import type { SceneState, VideoIdentitySheet, VideoPromptScene } from "@/lib/analytics/types";
import { round } from "@/lib/utils";
import { rankTokenMetadataForStory } from "@/lib/tokens/metadata-selection";
import { GeneratedCinematicScript, WalletStory } from "@/lib/types/domain";

const MAX_PROMPT_CHARS = 9_000;
const MAX_TOKEN_REFS_IN_PROMPT = 20;
const MAX_SCENES_IN_PROMPT = 12;
const MAX_SCENE_TEXT_CHARS = 220;

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

export interface VeoSceneMetadata {
  sceneNumber: number;
  durationSeconds: number;
  narration: string;
  visualPrompt: string;
  imageUrl: string | null;
  stateRef?: string;
  continuityAnchors?: string[];
  continuityPrompt?: string;
}

export interface VeoCoherenceMetadata {
  identity: VideoIdentitySheet;
  sceneStates: SceneState[];
  renderPolicy?: {
    factorization: "identity->state->render";
    continuityMode: string;
    lintMode: string;
  };
}

export interface GoogleVeoRenderPayload {
  provider: "google_veo";
  model: "veo-3.1-fast-generate-001";
  resolution: "720p" | "1080p";
  generateAudio: true;
  prompt: string;
  styleHints: string[];
  tokenMetadata: VeoTokenMetadata[];
  sceneMetadata: VeoSceneMetadata[];
  storyMetadata: {
    storyKind?: WalletStory["storyKind"];
    wallet: string;
    subjectAddress?: string;
    subjectChain?: WalletStory["subjectChain"];
    subjectName?: string | null;
    subjectSymbol?: string | null;
    rangeDays: number;
    packageType: WalletStory["packageType"];
    durationSeconds: number;
    analytics: WalletStory["analytics"];
  };
  coherence?: VeoCoherenceMetadata;
}

function unique<T>(values: T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function buildTokenMetadata(story: WalletStory): VeoTokenMetadata[] {
  return rankTokenMetadataForStory(story).map((item) => ({
    mint: item.mint,
    symbol: item.symbol,
    name: item.name,
    imageUrl: item.imageUrl,
    tradeCount: item.tradeCount,
    buyCount: item.buyCount,
    sellCount: item.sellCount,
    solVolume: round(item.solVolume, 6),
    lastSeenTimestamp: item.lastSeenTimestamp,
  }));
}

function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxChars - 3))}...`;
}

function compactSentence(value: string): string {
  const trimmed = value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();

  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function sanitizePromptText(value: string): string {
  return compactSentence(
    value
      .replace(/\b\d+(?:\.\d+)?\s*SOL\b/gi, "the bag")
      .replace(
        /\b\d+\s+(?:buys?|sells?|trades?|tokens?|hours?|minutes?|days?)\b/gi,
        "a blur of clicks",
      )
      .replace(/\bestimated\s+pnl\b/gi, "fortune")
      .replace(/\bfinal tape\b/gi, "final mood")
      .replace(/\bspent\b/gi, "risked")
      .replace(/\breceived\b/gi, "got back")
      .replace(/\b\d+(?:\.\d+)?\b/g, "")
      .replace(/\s{2,}/g, " "),
  );
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "opening":
      return "Entry Into The Trenches";
    case "rise":
      return "Heat Check";
    case "damage":
      return "Market Chaos";
    case "pivot":
      return "No-Cooldown Decision";
    case "climax":
      return "Main Character Spiral";
    case "aftermath":
      return "Sunrise Aftermath";
    default:
      return "Trailer Beat";
  }
}

function scaleIndex(index: number, sourceLength: number, targetLength: number): number {
  if (sourceLength <= 1 || targetLength <= 1) {
    return 0;
  }

  return Math.round((index * (sourceLength - 1)) / (targetLength - 1));
}

function synthesizeIdentity(
  story: WalletStory,
  tokenMetadata: VeoTokenMetadata[],
): VideoIdentitySheet {
  const walletShort = `${story.wallet.slice(0, 4)}...${story.wallet.slice(-4)}`;
  const archetype =
    story.videoIdentitySheet?.archetype ??
    story.walletPersonality ??
    story.analytics.styleClassification;
  const protagonist =
    story.videoIdentitySheet?.protagonist ??
    `${walletShort} as a trench protagonist under chart glow`;

  return {
    identityId: `story-${story.wallet.slice(0, 8)}-${story.rangeDays}`,
    archetype,
    protagonist,
    paletteCanon:
      story.videoIdentitySheet?.paletteCanon ?? [
        "neon chart green",
        "storm blue",
        "warning red",
      ],
    worldCanon:
      story.videoIdentitySheet?.worldCanon ?? [
        "dark trading room noir",
        "meme-trench skyline",
      ],
    lightingCanon:
      story.videoIdentitySheet?.lightingCanon ?? [
        "hard chart glow",
        "screen-lit haze",
      ],
    symbolCanon:
      story.videoIdentitySheet?.symbolCanon ??
      unique(
        [
          "glowing chart lines",
          "trading desk relics",
          ...tokenMetadata
            .slice(0, 2)
            .map((token) => `${token.symbol} poster fragments`),
        ],
      ),
    tokenAnchors:
      story.videoIdentitySheet?.tokenAnchors ??
      tokenMetadata.slice(0, 4).map((token, index) => ({
        mint: token.mint,
        symbol: token.symbol,
        name: token.name,
        imageUrl: token.imageUrl,
        role:
          index === 0 ? "primary" : index === 1 ? "secondary" : "supporting",
      })),
    negativeConstraints:
      story.videoIdentitySheet?.negativeConstraints ?? [
        "Do not replace the protagonist with chart-only abstraction.",
        "Do not invent new tokens or fake stat overlays.",
        "Do not break palette or world continuity mid-video.",
      ],
  };
}

function synthesizeSceneStates(
  story: WalletStory,
  script: GeneratedCinematicScript,
  identity: VideoIdentitySheet,
): SceneState[] {
  const promptScenes = story.videoPromptSequence ?? [];

  return script.scenes.map((scene, index) => {
    const promptScene =
      promptScenes[scaleIndex(index, promptScenes.length, script.scenes.length)];
    const continuityAnchors = unique(
      [
        identity.protagonist,
        identity.worldCanon[0],
        identity.paletteCanon[0],
        identity.tokenAnchors[0]?.symbol
          ? `${identity.tokenAnchors[0].symbol} remains visible`
          : undefined,
        ...(promptScene?.continuityAnchors ?? []),
      ].filter((value): value is string => Boolean(value)),
    ).slice(0, 5);

    return {
      sceneNumber: scene.sceneNumber,
      phase: promptScene?.phase ?? "opening",
      stateRef:
        promptScene?.stateRef ?? `${identity.identityId}-scene-${scene.sceneNumber}`,
      emotionVector: {
        confidence: 0.55,
        chaos: 0.45,
        desperation: 0.35,
        discipline: 0.55,
        luck: 0.5,
        intensity: 0.5,
      },
      subjectFocus:
        promptScene?.narrativePurpose ??
        sanitizePromptText(scene.narration) ??
        "keep the protagonist and token anchor readable",
      continuityAnchors,
      deltaFromPrevious:
        index === 0
          ? ["establish the identity sheet before any drift is allowed"]
          : ["advance the scene without replacing the protagonist or world canon"],
      transitionNote:
        promptScene?.continuityNote ??
        "Carry the same protagonist, palette, and token logic into the next cut.",
    };
  });
}

function resolveCoherence(input: {
  story: WalletStory;
  script: GeneratedCinematicScript;
  tokenMetadata: VeoTokenMetadata[];
}): VeoCoherenceMetadata {
  const identity = input.story.videoIdentitySheet
    ? input.story.videoIdentitySheet
    : synthesizeIdentity(input.story, input.tokenMetadata);

  const sceneStates =
    input.story.sceneStateSequence?.length
      ? alignSceneStatesToCount({
          identity,
          sceneStates: input.story.sceneStateSequence,
          targetCount: input.script.scenes.length,
        })
      : synthesizeSceneStates(input.story, input.script, identity);

  return {
    identity,
    sceneStates,
    renderPolicy: {
      factorization: "identity->state->render",
      continuityMode:
        "Reuse identity + state continuity prompts for every scene and chunk.",
      lintMode:
        "Strengthen scene continuity prompts before dispatch if anchors are underspecified.",
    },
  };
}

function strengthenContinuityPrompt(
  identity: VideoIdentitySheet,
  state: SceneState,
  prompt: string,
): string {
  return compactSentence(
    `${prompt} Preserve ${identity.protagonist}. Keep ${state.continuityAnchors
      .slice(0, 3)
      .join(", ")} stable in the frame.`,
  );
}

function lintSceneCoherence(input: {
  story: WalletStory;
  script: GeneratedCinematicScript;
  coherence: VeoCoherenceMetadata;
}): VeoSceneMetadata[] {
  const promptScenes = input.story.videoPromptSequence ?? [];

  return input.script.scenes.map((scene, index) => {
    const state = input.coherence.sceneStates[index];
    const promptScene =
      promptScenes[scaleIndex(index, promptScenes.length, input.script.scenes.length)];

    if (!state) {
      return {
        sceneNumber: scene.sceneNumber,
        durationSeconds: scene.durationSeconds,
        narration: scene.narration,
        visualPrompt: scene.visualPrompt,
        imageUrl: scene.imageUrl,
      };
    }

    const continuityAnchors = unique(
      [
        ...state.continuityAnchors,
        input.coherence.identity.protagonist,
        input.coherence.identity.worldCanon[0],
        input.coherence.identity.paletteCanon[0],
      ].filter((value): value is string => Boolean(value)),
    ).slice(0, 6);

    const continuityPrompt = strengthenContinuityPrompt(
      input.coherence.identity,
      { ...state, continuityAnchors },
      scene.continuityNote ??
        promptScene?.continuityNote ??
        buildSceneContinuityPrompt(input.coherence.identity, {
          ...state,
          continuityAnchors,
        }),
    );

    const themeOverlay = buildThemeOverlay(promptScene);
    const visualPrompt = compactSentence(
      [scene.visualPrompt, themeOverlay].filter(Boolean).join(" "),
    );

    return {
      sceneNumber: scene.sceneNumber,
      durationSeconds: scene.durationSeconds,
      narration: scene.narration,
      visualPrompt,
      imageUrl: scene.imageUrl,
      stateRef: scene.stateRef ?? state.stateRef,
      continuityAnchors,
      continuityPrompt,
    };
  });
}

function buildTokenReferenceLine(tokenMetadata: VeoTokenMetadata[]): string {
  const tokenRefs = tokenMetadata
    .slice(0, MAX_TOKEN_REFS_IN_PROMPT)
    .map((token) => {
      const name = token.name?.trim() ? `${token.symbol} (${token.name})` : token.symbol;
      return `${name} image=${token.imageUrl}`;
    })
    .join("; ");

  return tokenRefs
    ? `Token image anchors: ${tokenRefs}.`
    : "Token image anchors: none supplied.";
}

function buildIdentityBibleLines(identity: VideoIdentitySheet): string[] {
  return [
    `Archetype: ${identity.archetype}.`,
    `Protagonist: ${identity.protagonist}.`,
    `Palette canon: ${identity.paletteCanon.join(", ")}.`,
    `World canon: ${identity.worldCanon.join(", ")}.`,
    `Lighting canon: ${identity.lightingCanon.join(", ")}.`,
    `Symbol canon: ${identity.symbolCanon.join(", ")}.`,
    identity.tokenAnchors.length
      ? `Token anchors: ${identity.tokenAnchors
          .map((anchor) => `${anchor.role}:${anchor.symbol}`)
          .join(", ")}.`
      : "Token anchors: none supplied.",
    `Negative constraints: ${identity.negativeConstraints.join(" ")}`,
  ];
}

type AudioCanon = {
  leitmotifs: string[];
  act1Bed: string[];
  act2Bed: string[];
  act3Bed: string[];
};

function actForPhase(phase: string | undefined): 1 | 2 | 3 {
  switch (phase) {
    case "opening":
    case "rise":
      return 1;
    case "aftermath":
      return 3;
    case "damage":
    case "pivot":
    case "climax":
    default:
      return 2;
  }
}

function buildAudioCanon(input: {
  story: WalletStory;
  identity: VideoIdentitySheet;
  tokenMetadata: VeoTokenMetadata[];
}): AudioCanon {
  const archetype = (input.identity.archetype || "").toLowerCase();

  const archetypeMotif =
    archetype.includes("gambler") ? "cinematic synth pulse" :
    archetype.includes("prophet") ? "choir-like pad" :
    archetype.includes("trickster") ? "playful synth riff" :
    archetype.includes("martyr") ? "slow string pad" :
    archetype.includes("ghost") ? "hollow synth bed" :
    archetype.includes("survivor") ? "warm synth rise" :
    "clean ambient pad";

  const environmentMotif =
    input.identity.worldCanon.join(" ").toLowerCase().includes("rain") ||
    (input.story.analytics.styleClassification ?? "").toLowerCase().includes("chaos")
      ? "soft synth wash"
      : "clean ambient pad";

  const tokenMotif = input.tokenMetadata[0]?.symbol
    ? `${input.tokenMetadata[0].symbol} neon shimmer synth`
    : "soft synth shimmer";

  const leitmotifs = unique([
    "cinematic synth pulse",
    environmentMotif,
    archetypeMotif,
    tokenMotif,
  ]).slice(0, 3);

  return {
    leitmotifs,
    act1Bed: unique(["soft synth bed", "warm pad", "low pulse"]),
    act2Bed: unique(["driving synth bed", "tight low-end pulse", "rising arpeggio"]),
    act3Bed: unique(["resolved synth bed", "gentle pad", "soft piano wash"]),
  };
}

function buildSoundBibleLines(canon: AudioCanon): string[] {
  return [
    `Leitmotifs (keep present across scenes): ${canon.leitmotifs.join(", ")}.`,
    "Audio format: continuous background music bed + sparse voiceover commentary only. No character dialogue.",
    "Act 1 stays intimate and minimal; Act 2 escalates in intensity without harshness; Act 3 resolves into a gentle, clear mix.",
    "No sound effects, no crowd noise, no alarms, no glitch/distortion, no clipping. Maintain one continuous sound world.",
  ];
}

function buildSceneSoundReel(input: {
  sceneMetadata: VeoSceneMetadata[];
  sceneStates: SceneState[];
  canon: AudioCanon;
}): string[] {
  return input.sceneMetadata.slice(0, MAX_SCENES_IN_PROMPT).map((scene) => {
    const state =
      input.sceneStates.find((candidate) => candidate.sceneNumber === scene.sceneNumber) ??
      input.sceneStates[scene.sceneNumber - 1];

    const act = actForPhase(state?.phase);
    const bed = act === 1 ? input.canon.act1Bed[0] : act === 3 ? input.canon.act3Bed[0] : input.canon.act2Bed[0];
    const accent =
      state?.phase === "climax"
        ? "brief orchestral swell"
        : state?.phase === "damage"
          ? "tense low pulse"
          : state?.phase === "pivot"
            ? "clean synth lift"
            : state?.phase === "aftermath"
              ? "warm resolve"
              : "soft pad drift";

    return [
      `Scene ${scene.sceneNumber} sound`,
      `act=${act}`,
      `bed=${bed}`,
      `motifs=${input.canon.leitmotifs.join("+")}`,
      `accent=${accent}`,
    ].join(" | ");
  });
}

function buildStateTransitionLines(input: {
  sceneMetadata: VeoSceneMetadata[];
  sceneStates: SceneState[];
}): string[] {
  return input.sceneMetadata.slice(0, MAX_SCENES_IN_PROMPT).map((scene) => {
    const state =
      input.sceneStates.find((candidate) => candidate.sceneNumber === scene.sceneNumber) ??
      input.sceneStates[scene.sceneNumber - 1];
    const phase = state ? phaseLabel(state.phase) : "Trailer Beat";

    return [
      `Scene ${scene.sceneNumber}`,
      phase,
      state?.stateRef ? `stateRef=${state.stateRef}` : "",
      state ? `focus=${truncateText(state.subjectFocus, 110)}` : "",
      state?.deltaFromPrevious?.length
        ? `delta=${truncateText(state.deltaFromPrevious.join(", "), 90)}`
        : "",
      scene.continuityPrompt
        ? `continuity=${truncateText(scene.continuityPrompt, 120)}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");
  });
}

function buildSceneRealizationLines(sceneMetadata: VeoSceneMetadata[]): string[] {
  return sceneMetadata.slice(0, MAX_SCENES_IN_PROMPT).map((scene) => {
    const visual = sanitizePromptText(scene.visualPrompt);
    const narration = sanitizePromptText(scene.narration);
    const imageAnchor = scene.imageUrl ? `image=${scene.imageUrl}` : "image=none";
    return [
      `Scene ${scene.sceneNumber} realization`,
      `visual=${truncateText(visual, MAX_SCENE_TEXT_CHARS)}`,
      `narration=${truncateText(narration, 120)}`,
      imageAnchor,
    ].join(" | ");
  });
}

function buildThemeOverlay(promptScene?: VideoPromptScene): string {
  if (!promptScene) return "";
  const symbols = promptScene.symbolicVisuals?.length
    ? `Symbols: ${promptScene.symbolicVisuals.slice(0, 2).join(", ")}.`
    : "";
  return compactSentence(
    `Set the scene in ${promptScene.environment}. Visual style: ${promptScene.visualStyle}. ${symbols}`,
  );
}

function buildPrompt(input: {
  story: WalletStory;
  script: GeneratedCinematicScript;
  tokenMetadata: VeoTokenMetadata[];
  coherence: VeoCoherenceMetadata;
  sceneMetadata: VeoSceneMetadata[];
}): string {
  const trailerHook = sanitizePromptText(input.script.hookLine);
  const narrativeSummary = input.story.narrativeSummary?.trim()
    ? sanitizePromptText(input.story.narrativeSummary)
    : "";

  const audioCanon = buildAudioCanon({
    story: input.story,
    identity: input.coherence.identity,
    tokenMetadata: input.tokenMetadata,
  });

  const prompt = [
    "Create a funny, memetic cinematic trailer about a trader's last stretch in the Pump.fun trenches.",
    "This is cinema, not analytics. Never mention balances, PnL, trade counts, percentages, package tiers, or scoreboard numbers in dialogue, captions, or commentary.",
    "Render rule: every shot must be derived from identity bible + state transition reel + scene realization. Never re-invent the protagonist mid-video.",
    "Visual rule: diversify locations beyond trading desks. Use symbolic environments and cinematic settings; at most one desk-style shot.",
    "Sound rule: generate coherent trailer audio with a continuous background music bed and sparse voiceover commentary only. No character dialogue. No SFX, no crowd noise, no alarms, no distortion, no clipping.",
    narrativeSummary ? `Narrative summary: ${narrativeSummary}` : "",
    `Trailer hook: ${trailerHook}`,
    buildTokenReferenceLine(input.tokenMetadata),
    "When an image URL is supplied, treat it as the featured token's poster, shrine, sticker, hologram, or apparition inside the world of the scene.",
    "Hard constraints: stay faithful to the supplied identity, state continuity, token anchors, and scene metadata. Do not invent extra coins, fake stat overlays, or chart-only scenes without a human presence.",
    "Identity bible:",
    ...buildIdentityBibleLines(input.coherence.identity),
    "Sound bible:",
    ...buildSoundBibleLines(audioCanon),
    "State transition reel:",
    ...buildStateTransitionLines({
      sceneMetadata: input.sceneMetadata,
      sceneStates: input.coherence.sceneStates,
    }),
    "Scene sound reel:",
    ...buildSceneSoundReel({
      sceneMetadata: input.sceneMetadata,
      sceneStates: input.coherence.sceneStates,
      canon: audioCanon,
    }),
    "Scene realization reel:",
    ...buildSceneRealizationLines(input.sceneMetadata),
  ]
    .filter(Boolean)
    .join("\n");

  if (prompt.length <= MAX_PROMPT_CHARS) {
    return prompt;
  }

  return `${prompt.slice(0, MAX_PROMPT_CHARS - 60)}\n[Prompt truncated to fit model input budget.]`;
}

export function buildGoogleVeoRenderPayload(input: {
  walletStory: WalletStory;
  script: GeneratedCinematicScript;
  model?: "veo-3.1-fast-generate-001";
  resolution?: "720p" | "1080p";
}): GoogleVeoRenderPayload {
  const tokenMetadata = buildTokenMetadata(input.walletStory);
  const coherence = resolveCoherence({
    story: input.walletStory,
    script: input.script,
    tokenMetadata,
  });
  const sceneMetadata = lintSceneCoherence({
    story: input.walletStory,
    script: input.script,
    coherence,
  });

  return {
    provider: "google_veo",
    model: input.model ?? "veo-3.1-fast-generate-001",
    resolution: input.resolution ?? "1080p",
    generateAudio: true,
    prompt: buildPrompt({
      story: input.walletStory,
      script: input.script,
      tokenMetadata,
      coherence,
      sceneMetadata,
    }),
    styleHints: [
      "memetic",
      "cinematic",
      "high-energy-edit",
      "captioned",
      "satirical",
      "coherence-first",
    ],
    tokenMetadata,
    sceneMetadata,
    storyMetadata: {
      storyKind: input.walletStory.storyKind,
      wallet: input.walletStory.wallet,
      subjectAddress: input.walletStory.subjectAddress,
      subjectChain: input.walletStory.subjectChain,
      subjectName: input.walletStory.subjectName,
      subjectSymbol: input.walletStory.subjectSymbol,
      rangeDays: input.walletStory.rangeDays,
      packageType: input.walletStory.packageType,
      durationSeconds: input.walletStory.durationSeconds,
      analytics: input.walletStory.analytics,
    },
    coherence,
  };
}
