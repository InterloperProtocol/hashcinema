import {
  alignSceneStatesToCount,
  buildSceneContinuityPrompt,
} from "@/lib/analytics/videoCoherence";
import {
  detectSourceMediaProvider,
  sourceMediaAudioPolicy,
  type SourceMediaProvider,
} from "@/lib/cinema/sourceMedia";
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
  generateAudio: boolean;
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
    sourceMediaUrl?: string | null;
    sourceEmbedUrl?: string | null;
    sourceMediaProvider?: WalletStory["sourceMediaProvider"];
    sourceTranscript?: string | null;
    experience?: WalletStory["experience"];
    visibility?: WalletStory["visibility"];
    audioEnabled?: boolean | null;
    rangeDays: number;
    packageType: WalletStory["packageType"];
    durationSeconds: number;
    analytics: WalletStory["analytics"];
    worldbuilder?: WalletStory["worldbuilder"];
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

function normalizeCreativePromptText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();
}

function hasExternalLink(value: string): boolean {
  return /\b(?:https?:\/\/|www\.)\S+/i.test(value);
}

function sanitizeCreativePromptText(value: string, fallback: string): string {
  const normalized = normalizeCreativePromptText(value);
  if (!normalized) {
    return fallback;
  }

  if (hasExternalLink(normalized)) {
    return fallback;
  }

  return normalized;
}

function buildWorldbuilderPromptLines(worldbuilder?: WalletStory["worldbuilder"]): string[] {
  if (!worldbuilder) {
    return [];
  }

  const lines = [
    `Worldbuilder: ${worldbuilder.model} / ${worldbuilder.worldName}.`,
    `Worldbuilder verdict: ${worldbuilder.verdict}.`,
    `Worldbuilder summary: ${truncateText(worldbuilder.summary, 220)}.`,
  ];

  if (worldbuilder.knowledgeBase?.length) {
    lines.push(`Worldbuilder knowledge base: ${worldbuilder.knowledgeBase.slice(0, 4).join(" | ")}.`);
  }

  if (worldbuilder.manifold.continuityRules?.length) {
    lines.push(
      `Worldbuilder continuity rules: ${worldbuilder.manifold.continuityRules.slice(0, 3).join(" | ")}.`,
    );
  }

  if (worldbuilder.storyline?.length) {
    lines.push(`Worldbuilder storyline: ${worldbuilder.storyline.slice(0, 3).join(" | ")}.`);
  }

  return lines;
}

function buildSourceContextLines(story: WalletStory, sourceMediaProvider: SourceMediaProvider | null): string[] {
  if (!sourceMediaProvider) {
    return [];
  }

  const lines = [
    `Source context: ${sourceMediaProvider} source is canonical. Keep the generation silent so the external track can be stitched later.`,
  ];

  if (story.sourceTranscript?.trim()) {
    lines.push(`Source transcript spine: ${truncateText(story.sourceTranscript, 220)}.`);
  }

  if (story.sourceEmbedUrl) {
    lines.push("Source embed review is available internally, but do not invent replacement music.");
  }

  return lines;
}

function neutralStoryCardLines(requestKind?: WalletStory["storyKind"]): string[] {
  switch (requestKind) {
    case "bedtime_story":
      return [
        "hook: Hook | teaser=Open in a calm, safe world with soft wonder and no sudden tension spikes. | visual=Introduce the bedtime world gently. | narration=Set a reassuring tone. | transition=Break in",
        "build: Build | teaser=Introduce the main characters and the bedtime promise they are trying to keep. | visual=Keep the motion soft and readable. | narration=Keep the middle cozy. | transition=Push harder",
        "payoff: Payoff | teaser=Let the middle feel magical but reassuring, never frantic or overstimulating. | visual=Keep the climax warm and soft. | narration=Stay soothing. | transition=Stick the landing",
        "continuation: Next Step | teaser=Close with comfort, resolution, and an unmistakable invitation to rest. | visual=Leave the last frame warm and quiet. | narration=End on a restful note. | transition=Queue sequel",
      ];
    case "music_video":
      return [
        "hook: Hook | teaser=Open on the track identity and the hook that defines the whole cut. | visual=Launch with a bold performance image. | narration=Introduce the track with confidence. | transition=Break in",
        "build: Build | teaser=Let the middle ride the beat, the choreography, or the performance details. | visual=Raise motion and scale while keeping the subject locked. | narration=Keep the momentum moving. | transition=Push harder",
        "payoff: Payoff | teaser=Escalate into a chorus-sized visual turn that feels designed for replay. | visual=Treat the climax like a poster frame. | narration=Land the hook hard. | transition=Stick the landing",
        "continuation: Next Step | teaser=Close on a final frame that lands like a poster, playlist cover, or tour card. | visual=Leave room for an encore. | narration=Keep the ending open. | transition=Queue sequel",
      ];
    case "scene_recreation":
      return [
        "hook: Hook | teaser=Open by naming the source scene and the emotional promise it carries. | visual=Preserve the source-scene atmosphere and blocking. | narration=Set the opening line cleanly. | transition=Break in",
        "build: Build | teaser=Preserve the dialogue spine and the blocking rhythm while reshaping the skin. | visual=Raise motion without changing the source identity. | narration=Keep the middle act tight. | transition=Push harder",
        "payoff: Payoff | teaser=Escalate into a trailer-grade reinterpretation that stays faithful but sharper. | visual=Treat the climax like a trailer finish. | narration=Keep the payoff focused. | transition=Stick the landing",
        "continuation: Next Step | teaser=Close on a final frame that feels like a remembered scene rebuilt at higher voltage. | visual=Leave room for a sequel beat. | narration=Keep the handoff clean. | transition=Queue sequel",
      ];
    default:
      return [
        "hook: Hook | teaser=Establish the world, mood, and visual grammar before the action starts. | visual=Open with a clear establishing image. | narration=Introduce the brief cleanly. | transition=Break in",
        "build: Build | teaser=Introduce the characters, symbols, or references that define the story. | visual=Raise motion, scale, or camera aggression while keeping the subject stable. | narration=Keep the middle moving. | transition=Push harder",
        "payoff: Payoff | teaser=Escalate the brief into a cinematic middle with stronger motion and clearer stakes. | visual=Treat the climax like a poster frame. | narration=Land the emotional turn. | transition=Stick the landing",
        "continuation: Next Step | teaser=Land on a memorable closing image that feels designed to be replayed or shared. | visual=Leave the final image open enough for a sequel. | narration=Keep the ending clean. | transition=Queue sequel",
      ];
  }
}

function neutralStoryBeatLine(requestKind?: WalletStory["storyKind"]): string {
  switch (requestKind) {
    case "bedtime_story":
      return "Story beats: open in a calm world | introduce the bedtime promise | keep the middle cozy | close with rest.";
    case "music_video":
      return "Story beats: open on the track identity | ride the beat through the middle | build to a chorus-sized turn | end like a poster frame.";
    case "scene_recreation":
      return "Story beats: open by naming the source scene | preserve the dialogue spine | escalate into a sharper reinterpretation | close on a remembered frame.";
    default:
      return "Story beats: establish the world | introduce the characters | escalate the stakes | land on a memorable closing image.";
  }
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

function buildCreativeStoryPrompt(input: {
  story: WalletStory;
  script: GeneratedCinematicScript;
  generateAudio: boolean;
}): string {
  const sourceMediaProvider =
    input.story.sourceMediaProvider === "youtube" || input.story.sourceMediaProvider === "spotify"
      ? input.story.sourceMediaProvider
      : detectSourceMediaProvider(input.story.sourceMediaUrl);
  const sourceAudioMode = sourceMediaAudioPolicy(sourceMediaProvider);
  const subjectFallback =
    input.story.storyKind === "bedtime_story"
      ? "the supplied bedtime story"
      : input.story.storyKind === "music_video"
        ? "the supplied track"
        : input.story.storyKind === "scene_recreation"
          ? "the supplied source scene"
          : "the supplied brief";
  const descriptionFallback =
    input.story.storyKind === "bedtime_story"
      ? "Use the supplied bedtime story as the main source of truth."
      : input.story.storyKind === "music_video"
        ? "Use the supplied track or concept notes as the main source of truth."
        : input.story.storyKind === "scene_recreation"
          ? "Use the supplied source scene as the main source of truth."
          : "Use the supplied brief as the main source of truth.";
  const directionFallback =
    input.story.storyKind === "bedtime_story"
      ? "Keep the adaptation soft, safe, and soothing."
      : input.story.storyKind === "music_video"
        ? "Keep the beat, chorus, and performance language central."
        : input.story.storyKind === "scene_recreation"
          ? "Preserve the source scene's emotional spine, blocking, and timing without quoting external links or lyrics."
          : "Keep the cut concise, visual, and replayable.";
  const subject = sanitizeCreativePromptText(input.story.subjectName ?? "", subjectFallback);
  const description = sanitizeCreativePromptText(
    input.story.subjectDescription?.trim() ?? "",
    descriptionFallback,
  );
  const direction = sanitizeCreativePromptText(
    input.story.requestedPrompt?.trim() ?? "",
    directionFallback,
  );
  const linkedSourceDetected = [
    input.story.subjectName,
    input.story.subjectDescription,
    input.story.requestedPrompt,
  ].some((value) => hasExternalLink(normalizeCreativePromptText(value ?? "")));
  const storyCards = input.story.storyCards?.length ? input.story.storyCards : [];
  const storyCardLines = linkedSourceDetected
    ? neutralStoryCardLines(input.story.storyKind).join("\n")
    : storyCards
        .slice(0, 4)
        .map(
          (card) =>
            `${sanitizeCreativePromptText(card.phase, "hook")}: ${sanitizeCreativePromptText(card.title, subject)} | teaser=${sanitizeCreativePromptText(card.teaser, description)} | visual=${sanitizeCreativePromptText(card.visualCue, "Keep the frame cinematic and source-faithful.")} | narration=${sanitizeCreativePromptText(card.narrationCue, "Keep the narration concise and source-faithful.")} | transition=${sanitizeCreativePromptText(card.transitionLabel, "Next beat")}`,
        )
        .join("\n");
  const beats =
    linkedSourceDetected
      ? neutralStoryBeatLine(input.story.storyKind)
      : (input.story.storyBeats?.slice(0, 6)
          .map((beat) => sanitizeCreativePromptText(beat, ""))
          .filter(Boolean)
          .join(" | ") ?? "");
  const beatLine = beats
    ? beats.startsWith("Story beats:")
      ? beats
      : `Story beats: ${beats}.`
    : "Story beats: beginning, escalation, closing image.";
  const tone =
    input.story.storyKind === "bedtime_story"
      ? "Build a safe, gentle bedtime short with calm pacing, warm visuals, and reassuring narration."
      : input.story.storyKind === "music_video"
        ? "Build a trailer-first music video. Let the beat, chorus, and performance language control the cut."
        : input.story.storyKind === "scene_recreation"
          ? "Build a trailer-grade scene recreation. Preserve dialogue cadence and blocking while remaking the skin."
          : "Build a cinematic short for a general topic or story, not a trading recap.";
  const audioRule =
    sourceAudioMode === "source_track"
      ? "Audio is disabled for generation. Keep the render silent so the external track or lyric spine can be stitched in later."
      : input.story.storyKind === "bedtime_story"
        ? "Narration must stay on and the music bed should feel like very light classical accompaniment."
        : input.story.storyKind === "music_video"
          ? input.generateAudio
            ? "Audio is enabled. Follow the lyrics, beat, chorus, and musical dynamics without inventing new song facts."
            : "Audio is muted for now, but the visual rhythm should still read like a music video ready for sound."
          : input.story.storyKind === "scene_recreation"
            ? input.generateAudio
              ? "Audio is enabled. Preserve the dialogue cadence and source-scene timing without inventing new quotes."
              : "Audio is muted for now, but the reconstruction should still preserve dialogue timing and scene blocking."
            : input.generateAudio
              ? "Audio is enabled. Use sparse voiceover and a restrained score that follows the lyrics or dialogue notes when present."
              : "No narration, no music, no sound effects. The visual edit carries the story alone.";

  const sourceContextLines = buildSourceContextLines(input.story, sourceMediaProvider);
  const worldbuilderLines = buildWorldbuilderPromptLines(input.story.worldbuilder);

  const sceneLines = input.script.scenes
    .slice(0, MAX_SCENES_IN_PROMPT)
    .map((scene) => {
      const imageAnchor = scene.imageUrl ? `image=${scene.imageUrl}` : "image=none";
      const visual = linkedSourceDetected
        ? "Keep the frame cinematic and source-faithful."
        : sanitizeCreativePromptText(
            scene.visualPrompt,
            "Keep the frame cinematic and source-faithful.",
          );
      const narration = linkedSourceDetected
        ? "Keep the narration concise and source-faithful."
        : sanitizeCreativePromptText(
            scene.narration,
            "Keep the narration concise and source-faithful.",
          );
      return `Scene ${scene.sceneNumber} | visual=${truncateText(visual, 160)} | narration=${truncateText(narration, 100)} | ${imageAnchor}`;
    })
    .join("\n");

  return [
    tone,
    `Subject: ${subject}.`,
    `Brief: ${description}`,
    `Direction: ${direction}`,
    audioRule,
    ...sourceContextLines,
    ...worldbuilderLines,
    "Hard constraints: stay faithful to the supplied brief, keep continuity coherent, never shift into memecoin or wallet analytics language, and do not surface raw URLs or link text in the rendered scene. If the source is YouTube or Spotify, treat the source link and transcript as canonical, keep the generated render silent, and do not invent replacement music.",
    beatLine,
    storyCardLines ? `Story cards:\n${storyCardLines}` : "",
    "Scene reel:",
    sceneLines,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrompt(input: {
  story: WalletStory;
  script: GeneratedCinematicScript;
  tokenMetadata: VeoTokenMetadata[];
  coherence: VeoCoherenceMetadata;
  sceneMetadata: VeoSceneMetadata[];
  generateAudio: boolean;
}): string {
  if (input.story.storyKind !== "token_video") {
    return buildCreativeStoryPrompt({
      story: input.story,
      script: input.script,
      generateAudio: input.generateAudio,
    });
  }

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
  const sourceMediaProvider =
    input.walletStory.sourceMediaProvider === "youtube" ||
    input.walletStory.sourceMediaProvider === "spotify"
      ? input.walletStory.sourceMediaProvider
      : detectSourceMediaProvider(input.walletStory.sourceMediaUrl);
  const sourceAudioMode = sourceMediaAudioPolicy(sourceMediaProvider);
  const generateAudio =
    sourceAudioMode === "source_track"
      ? false
      : typeof input.walletStory.audioEnabled === "boolean"
        ? input.walletStory.audioEnabled
        : input.walletStory.storyKind === "bedtime_story" ||
          input.walletStory.storyKind === "music_video";
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
    generateAudio,
    prompt: buildPrompt({
      story: input.walletStory,
      script: input.script,
      tokenMetadata,
      coherence,
      sceneMetadata,
      generateAudio,
    }),
    styleHints: [
      "cinematic",
      "coherence-first",
      ...(sourceMediaProvider
        ? [
            "source-linked",
            sourceAudioMode === "source_track" ? "external-audio" : "source-faithful",
            "source-transcript-aware",
          ]
        : []),
      ...(input.walletStory.storyKind === "token_video"
        ? ["memetic", "high-energy-edit", "captioned", "satirical"]
        : input.walletStory.storyKind === "bedtime_story"
          ? ["bedtime", "gentle", "narration-led", "classical-soft"]
          : input.walletStory.storyKind === "music_video"
            ? ["music-video", "chorus-led", "performance-first", "beat-synced"]
            : input.walletStory.storyKind === "scene_recreation"
              ? ["scene-recreation", "dialogue-led", "continuity-first", "source-faithful"]
              : ["story-led", "clean-edit", "design-forward"]),
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
      sourceMediaUrl: input.walletStory.sourceMediaUrl,
      sourceEmbedUrl: input.walletStory.sourceEmbedUrl,
      sourceMediaProvider,
      sourceTranscript: input.walletStory.sourceTranscript,
      experience: input.walletStory.experience,
      visibility: input.walletStory.visibility,
      audioEnabled: generateAudio,
      rangeDays: input.walletStory.rangeDays,
      packageType: input.walletStory.packageType,
      durationSeconds: input.walletStory.durationSeconds,
      analytics: input.walletStory.analytics,
      worldbuilder: input.walletStory.worldbuilder ?? null,
    },
    coherence,
  };
}
