import { openRouterJson } from "@/lib/ai/openrouter";
import {
  alignSceneStatesToCount,
  buildSceneContinuityPrompt,
} from "@/lib/analytics/videoCoherence";
import { buildStoryCards } from "@/lib/cinema/storyCards";
import { logger } from "@/lib/logging/logger";
import {
  isHttpUrl,
  rankTokenMetadataForStory,
} from "@/lib/tokens/metadata-selection";
import {
  CinematicScene,
  GeneratedCinematicScript,
  WalletStory,
} from "@/lib/types/domain";
import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";

const sceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  visualPrompt: z.string().min(10),
  narration: z.string().min(10),
  durationSeconds: z.number().int().positive(),
  imageUrl: z.string().url().nullable().optional(),
  stateRef: z.string().min(1).optional(),
  continuityNote: z.string().min(1).optional(),
});

const scriptSchema = z.object({
  hookLine: z.string().min(10),
  scenes: z.array(sceneSchema).min(3).max(12),
});

interface TokenImageReference {
  mint: string;
  symbol: string;
  name: string | null;
  imageUrl: string;
  tradeCount: number;
  lastSeenTimestamp: number;
  impactScore: number;
}

export function buildPumpImageReferences(story: WalletStory): TokenImageReference[] {
  return rankTokenMetadataForStory(story).map((item) => ({
    mint: item.mint,
    symbol: item.symbol,
    name: item.name,
    imageUrl: item.imageUrl,
    tradeCount: item.tradeCount,
    lastSeenTimestamp: item.lastSeenTimestamp,
    impactScore: item.impactScore,
  }));
}

export function assignSceneImageUrls(
  scenes: CinematicScene[],
  imagePool: string[],
): CinematicScene[] {
  const dedupedPool = [...new Set(imagePool.filter((url) => isHttpUrl(url)))];

  if (!dedupedPool.length) {
    return scenes.map((scene) => ({
      ...scene,
      imageUrl: isHttpUrl(scene.imageUrl) ? scene.imageUrl : null,
    }));
  }

  return scenes.map((scene, index) => ({
    ...scene,
    imageUrl:
      isHttpUrl(scene.imageUrl) ? scene.imageUrl : dedupedPool[index % dedupedPool.length]!,
  }));
}

function normalizeSceneDurations(
  scenes: CinematicScene[],
  targetDuration: number,
): CinematicScene[] {
  const total = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (total <= 0) {
    const equal = Math.max(1, Math.floor(targetDuration / scenes.length));
    return scenes.map((scene) => ({ ...scene, durationSeconds: equal }));
  }

  const scaled = scenes.map((scene) => ({
    ...scene,
    durationSeconds: Math.max(
      2,
      Math.round((scene.durationSeconds / total) * targetDuration),
    ),
  }));

  const scaledTotal = scaled.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const diff = targetDuration - scaledTotal;
  if (diff !== 0 && scaled.length) {
    scaled[scaled.length - 1]!.durationSeconds += diff;
  }

  return scaled;
}

function buildFallbackHookLine(story: WalletStory): string {
  if (story.storyKind === "token_video") {
    const symbol = story.subjectSymbol ?? "TOKEN";
    const name = story.subjectName ?? symbol;
    const style = story.styleLabel ?? story.analytics.styleClassification;
    return `${name} moves like ${style}, and the ticker wants a hero entrance.`;
  }

  const subject = story.subjectName ?? "this trailer";
  return `${subject} is staged as a ${creativeStoryLabel(story.storyKind)}, and the opening frame wants to land immediately.`;
}

function scaleIndex(index: number, sourceLength: number, targetLength: number): number {
  if (sourceLength <= 1 || targetLength <= 1) {
    return 0;
  }

  return Math.round((index * (sourceLength - 1)) / (targetLength - 1));
}

function creativeStoryLabel(storyKind: WalletStory["storyKind"]): string {
  switch (storyKind) {
    case "bedtime_story":
      return "bedtime story";
    case "music_video":
      return "music video";
    case "scene_recreation":
      return "scene recreation";
    case "generic_cinema":
    default:
      return "cinematic short";
  }
}

function buildSceneDirectiveRefs(story: WalletStory, targetCount: number) {
  const identity = story.videoIdentitySheet;
  const promptScenes = story.videoPromptSequence ?? [];

  if (!identity) {
    return Array.from({ length: targetCount }, (_, index) => ({
      stateRef: undefined,
      continuityNote: promptScenes[index]?.continuityNote,
      promptScene: promptScenes[index],
    }));
  }

  const alignedStates = alignSceneStatesToCount({
    identity,
    sceneStates: story.sceneStateSequence ?? [],
    targetCount,
  });

  return alignedStates.map((state, index) => {
    const promptScene =
      promptScenes[scaleIndex(index, promptScenes.length, targetCount)] ?? undefined;

    return {
      stateRef: state.stateRef,
      continuityNote:
        promptScene?.continuityNote ?? buildSceneContinuityPrompt(identity, state),
      promptScene,
    };
  });
}

function enrichScenesWithCoherence(
  story: WalletStory,
  scenes: CinematicScene[],
): CinematicScene[] {
  const directives = buildSceneDirectiveRefs(story, scenes.length);

  return scenes.map((scene, index) => ({
    ...scene,
    stateRef: scene.stateRef ?? directives[index]?.stateRef,
    continuityNote: scene.continuityNote ?? directives[index]?.continuityNote,
  }));
}

function buildCinematicPromptInput(story: WalletStory): Record<string, unknown> {
  return {
    storyKind: story.storyKind ?? "wallet_recap",
    wallet: story.wallet,
    subjectAddress: story.subjectAddress,
    subjectChain: story.subjectChain,
    subjectName: story.subjectName,
    subjectSymbol: story.subjectSymbol,
    subjectDescription: story.subjectDescription,
    sourceMediaUrl: story.sourceMediaUrl,
    sourceEmbedUrl: story.sourceEmbedUrl,
    sourceMediaProvider: story.sourceMediaProvider,
    sourceTranscript: story.sourceTranscript,
    stylePreset: story.stylePreset,
    styleLabel: story.styleLabel,
    requestedPrompt: story.requestedPrompt,
    tokenLinks: story.tokenLinks,
    marketSnapshot: story.marketSnapshot,
    rangeDays: story.rangeDays,
    packageType: story.packageType,
    durationSeconds: story.durationSeconds,
    analytics: story.analytics,
    walletPersonality: story.walletPersonality,
    walletSecondaryPersonality: story.walletSecondaryPersonality,
    walletModifiers: story.walletModifiers,
    narrativeSummary: story.narrativeSummary,
    storyBeats: story.storyBeats,
    storyCards: story.storyCards,
    continuationPrompt: story.continuationPrompt,
    behaviorPatterns: story.behaviorPatterns,
    funObservations: story.funObservations,
    keyEvents: story.keyEvents,
    worldbuilder: story.worldbuilder,
  };
}

export function buildFallbackCinematicScript(
  story: WalletStory,
  tokenImageReferences: TokenImageReference[],
): GeneratedCinematicScript {
  if (story.storyKind !== "token_video") {
    const cards =
      story.storyCards?.length
        ? story.storyCards
        : buildStoryCards({
            requestKind: story.storyKind,
            subjectName: story.subjectName,
            subjectDescription: story.subjectDescription,
            requestedPrompt: story.requestedPrompt,
            storyBeats: story.storyBeats,
            audioEnabled: story.audioEnabled,
          });
    const sceneCount = Math.min(4, Math.max(3, cards.length));
    const duration = Math.max(2, Math.round(story.durationSeconds / sceneCount));
    const roughScenes: CinematicScene[] = Array.from({ length: sceneCount }, (_, index) => {
      const card = cards[index] ?? cards[cards.length - 1];
      return {
        sceneNumber: index + 1,
        visualPrompt:
          card?.visualCue ??
          `${creativeStoryLabel(story.storyKind)} opening image with a clear emotional hook.`,
        narration:
          card?.narrationCue ??
          card?.teaser ??
          story.narrativeSummary ??
          "The brief keeps moving toward a memorable landing frame.",
        durationSeconds: duration,
        imageUrl: null,
        stateRef: `creative-${story.storyKind ?? "cinema"}-scene-${index + 1}`,
        continuityNote:
          card?.transitionLabel ?? "Carry the same emotional spine into the next cut.",
      };
    });

    const normalizedScenes = normalizeSceneDurations(roughScenes, story.durationSeconds);
    return {
      hookLine: buildFallbackHookLine(story),
      scenes: normalizedScenes,
    };
  }

  const directives = buildSceneDirectiveRefs(story, 3);
  const promptScenes = story.videoPromptSequence ?? [];
  const roughScenes: CinematicScene[] = Array.from({ length: 3 }, (_, index) => {
    const promptScene = directives[index]?.promptScene ?? promptScenes[index];
    const defaultVisuals = [
      "Open on the protagonist entering a neon trading room with trailer-grade tension.",
      "Push into the volatile middle act with continuity-first motion and token anchors still in frame.",
      "Close on an aftermath tableau that feels earned, bruised, and strangely triumphant.",
    ];
    const defaultNarration = [
      story.narrativeSummary ?? "The room knew this session would not stay calm.",
      story.behaviorPatterns?.[0] ??
        "Momentum and emotion kept taking turns holding the wheel.",
      story.funObservations?.[0] ??
        "The final beat landed like trench folklore instead of a spreadsheet.",
    ];

    return {
      sceneNumber: index + 1,
      visualPrompt:
        promptScene?.providerPrompts.veo ?? promptScene?.visualStyle ?? defaultVisuals[index]!,
      narration:
        promptScene?.narrationHook ?? defaultNarration[index]!,
      durationSeconds: Math.max(2, Math.round(story.durationSeconds / 3)),
      imageUrl: tokenImageReferences[index]?.imageUrl ?? null,
      stateRef: directives[index]?.stateRef,
      continuityNote: directives[index]?.continuityNote,
    };
  });

  const normalizedScenes = normalizeSceneDurations(roughScenes, story.durationSeconds);
  const scenesWithImages = assignSceneImageUrls(
    normalizedScenes,
    tokenImageReferences.map((reference) => reference.imageUrl),
  );

  return {
    hookLine: buildFallbackHookLine(story),
    scenes: enrichScenesWithCoherence(story, scenesWithImages),
  };
}

export async function generateCinematicScript(
  story: WalletStory,
): Promise<GeneratedCinematicScript> {
  const tokenImageReferences = buildPumpImageReferences(story);

  try {
    const templatePath = path.join(
      process.cwd(),
      "prompts",
      "cinematic_prompt_template.md",
    );
    const template = await readFile(templatePath, "utf8");
    const imageReferencePayload = tokenImageReferences.map((reference) => ({
      mint: reference.mint,
      symbol: reference.symbol,
      name: reference.name,
      imageUrl: reference.imageUrl,
      tradeCount: reference.tradeCount,
      impactScore: reference.impactScore,
    }));

    const raw = await openRouterJson<unknown>({
      temperature: 0.35,
      maxTokens: 1600,
      messages: [
        {
          role: "system",
          content: template,
        },
        {
          role: "user",
          content:
            `Build a cinematic script from these structured inputs.\n\n` +
            `Story facts JSON:\n${JSON.stringify(buildCinematicPromptInput(story))}` +
            `\n\nIdentity bible JSON:\n${JSON.stringify(story.videoIdentitySheet ?? null)}` +
            `\n\nScene state sequence JSON:\n${JSON.stringify(story.sceneStateSequence ?? [])}` +
            `\n\nDerived directorial prompts JSON:\n${JSON.stringify(story.videoPromptSequence ?? [])}` +
            `\n\nPump.fun token image metadata to use in scene imageUrl fields when relevant:\n${JSON.stringify(imageReferencePayload)}`,
        },
      ],
    });

    const parsed = scriptSchema.parse(raw);
    const normalizedScenes = normalizeSceneDurations(
      parsed.scenes.map((scene) => ({
        ...scene,
        imageUrl: scene.imageUrl ?? null,
      })),
      story.durationSeconds,
    );
    const scenesWithImages = assignSceneImageUrls(
      normalizedScenes,
      tokenImageReferences.map((reference) => reference.imageUrl),
    );

    return {
      hookLine: parsed.hookLine,
      scenes: enrichScenesWithCoherence(story, scenesWithImages),
    };
  } catch (error) {
    logger.warn("cinematic_script_openrouter_failed_fallback", {
      component: "ai_cinematic",
      stage: "generate_script",
      wallet: story.wallet,
      errorCode: "cinematic_script_openrouter_failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    return buildFallbackCinematicScript(story, tokenImageReferences);
  }
}
