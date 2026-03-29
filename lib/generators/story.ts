import { buildContinuationPrompt, buildStoryCards } from "@/lib/cinema/storyCards";
import { detectSourceMediaProvider, sourceMediaAudioPolicy } from "@/lib/cinema/sourceMedia";
import { getTokenVideoStylePreset } from "@/lib/memecoins/styles";
import { JobDocument, ReportDocument, WalletStory } from "@/lib/types/domain";
import { buildTianezhaWorldbuilder } from "@/lib/worldbuilder/tianezha";

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requestKindLabel(requestKind: JobDocument["requestKind"]): string {
  switch (requestKind) {
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

function audioDirection(job: JobDocument): string {
  const sourceMediaProvider =
    job.sourceMediaProvider === "youtube" || job.sourceMediaProvider === "spotify"
      ? job.sourceMediaProvider
      : detectSourceMediaProvider(job.sourceMediaUrl);
  if (sourceMediaAudioPolicy(sourceMediaProvider) === "source_track") {
    return `Audio direction: keep this render silent and preserve the source-link timing; the ${sourceMediaProvider} track or lyric spine will be stitched in later.`;
  }

  switch (job.requestKind) {
    case "bedtime_story":
      return "Audio direction: gentle narration with very light classical music.";
    case "music_video":
      return job.audioEnabled
        ? "Audio direction: follow the lyrics, beat, and chorus structure with a music-video cadence."
        : "Audio direction: visual-first music video grammar with the beat kept in mind for a later audio pass.";
    case "scene_recreation":
      return job.audioEnabled
        ? "Audio direction: preserve dialogue cadence and scene timing while keeping the recreation legally and structurally grounded."
        : "Audio direction: visual-first scene recreation with dialogue timing preserved as an invisible spine.";
    default:
      if (job.audioEnabled) {
        return "Audio direction: sound is enabled and can follow lyrical or rhythmic notes if provided.";
      }
      return "Audio direction: silent visual-first cut with no narration and no music.";
  }
}

function buildStoryBeats(input: {
  job: JobDocument;
  storyCards: ReturnType<typeof buildStoryCards>;
}): string[] {
  if (input.storyCards.length) {
    return input.storyCards.map((card) => card.teaser);
  }

  if (input.job.requestKind === "bedtime_story") {
    return [
      "Open in a calm, safe world with soft wonder and no sudden tension spikes.",
      "Introduce the main characters and the bedtime promise they are trying to keep.",
      "Let the middle feel magical but reassuring, never frantic or overstimulating.",
      "Close with comfort, resolution, and an unmistakable invitation to rest.",
    ];
  }

  if (input.job.requestKind === "music_video") {
    return [
      "Open on the track identity and the hook that defines the whole cut.",
      "Let the middle ride the beat, the choreography, or the performance details.",
      "Escalate into a chorus-sized visual turn that feels designed for replay.",
      "Close on a final frame that lands like a poster, playlist cover, or tour card.",
    ];
  }

  if (input.job.requestKind === "scene_recreation") {
    return [
      "Open by naming the source scene and the emotional promise it carries.",
      "Preserve the dialogue spine and the blocking rhythm while reshaping the skin.",
      "Escalate into a trailer-grade reinterpretation that stays faithful but sharper.",
      "Close on a final frame that feels like a remembered scene rebuilt at higher voltage.",
    ];
  }

  return [
    "Establish the world, mood, and visual grammar before the action starts.",
    "Introduce the characters, symbols, or references that define the story.",
    "Escalate the brief into a cinematic middle with stronger motion and clearer stakes.",
    "Land on a memorable closing image that feels designed to be replayed or shared.",
  ];
}

function buildBehaviorPatterns(job: JobDocument, styleLabel: string): string[] {
  if (job.requestKind === "bedtime_story") {
    return [
      "Narration-first pacing built for winding down instead of spiking attention.",
      "Very soft classical underscore with warm visual continuity across scenes.",
      `Style reference stays anchored to ${styleLabel.toLowerCase()} while protecting a calm bedtime tone.`,
    ];
  }

  if (job.requestKind === "music_video") {
    return [
      "Beat-aware pacing keeps the edit locked to the track, chorus, and refrains.",
      "Lyrics or song notes steer the camera language more than any analytics spine.",
      `Style reference stays anchored to ${styleLabel.toLowerCase()} while protecting a performance-film tone.`,
    ];
  }

  if (job.requestKind === "scene_recreation") {
    return [
      "Dialogue cadence and blocking cues drive the reconstruction instead of wallet stats.",
      "The source scene sets the spine; the remake can change the skin and scale.",
      `Style reference stays anchored to ${styleLabel.toLowerCase()} while protecting source-scene fidelity.`,
    ];
  }

  return [
    "Prompt-driven cinematic generation rather than token-analytics storytelling.",
    "Character references and story notes drive the shot design and narration arc.",
    `${audioDirection(job)} ${styleLabel} controls the visual finish.`,
  ];
}

function buildFunObservations(job: JobDocument): string[] {
  if (job.requestKind === "bedtime_story") {
    return [
      "The bedtime mode keeps the pacing soft enough for end-of-day viewing.",
      "Parents can paste a full story and let HashCinema turn it into a narrated short.",
      "Classical cues stay intentionally light so the narration remains the center of gravity.",
    ];
  }

  if (job.requestKind === "music_video") {
    return [
      "The track can behave like a trailer hook instead of a static audio bed.",
      "Verse, bridge, and chorus moments can all become visual story beats.",
      "The cut can read like a tour poster that learned how to move.",
    ];
  }

  if (job.requestKind === "scene_recreation") {
    return [
      "A remembered scene becomes a trailer-grade reinterpretation instead of a copy.",
      "Dialogue, blocking, and emotional timing stay intact even when the skin changes.",
      "The reconstruction can feel like a remake trailer that knows the source text deeply.",
    ];
  }

  return [
    "This mode treats prompts, characters, and lyrical notes as the primary source material.",
    "The story can be visual-only by default, then opt into sound when the brief calls for it.",
    "The generator is not locked to memecoins, wallets, or chain metadata.",
  ];
}

function buildMemorableMoments(job: JobDocument): string[] {
  if (job.requestKind === "bedtime_story") {
    return [
      "The pasted bedtime story becomes the spine of the final narrated short.",
      "Each scene is allowed to stay gentle, readable, and safe for winding down.",
    ];
  }

  if (job.requestKind === "music_video") {
    return [
      "The chorus can land as a hero shot that feels built for replay.",
      "A well-timed cut can make the song feel bigger than the room around it.",
    ];
  }

  if (job.requestKind === "scene_recreation") {
    return [
      "The remake can land like a scene you know, rebuilt at higher voltage.",
      "A preserved line read can carry the whole trailer spine without overexplaining it.",
    ];
  }

  return [
    "Character references can steer the visual identity without forcing a rigid script.",
    "Story notes and rhythm hints shape the pacing even when sound stays off.",
  ];
}

function buildNarrativeSummary(job: JobDocument): string {
  const subject = trimOrNull(job.subjectName) ?? "Untitled brief";
  const description =
    trimOrNull(job.subjectDescription) ??
    (job.requestKind === "bedtime_story"
      ? "A parent-supplied story becomes a calm narrated short."
      : job.requestKind === "music_video"
        ? "A track or song concept becomes a trailer-first music video."
        : job.requestKind === "scene_recreation"
          ? "A source scene becomes a trailer-grade recreation."
          : "A prompt-led cinematic brief becomes a short-form visual story.");
  const requested = trimOrNull(job.requestedPrompt);
  const sourceMediaProvider =
    job.sourceMediaProvider === "youtube" || job.sourceMediaProvider === "spotify"
      ? job.sourceMediaProvider
      : detectSourceMediaProvider(job.sourceMediaUrl);
  const sourceLine =
    sourceMediaAudioPolicy(sourceMediaProvider) === "source_track"
      ? `Source-link policy: the ${sourceMediaProvider} track stays external and the render stays silent until mux time.`
      : null;

  return [
    `${subject} is staged as a ${job.videoSeconds}-second ${requestKindLabel(job.requestKind)}.`,
    description,
    audioDirection(job),
    sourceLine,
    requested ? `Creative direction: ${requested}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildPromptVideoArtifacts(input: {
  job: JobDocument;
}): {
  report: Omit<ReportDocument, "summary" | "downloadUrl">;
  story: WalletStory;
} {
  const style = getTokenVideoStylePreset(input.job.stylePreset);
  const sourceMediaProvider =
    input.job.sourceMediaProvider === "youtube" || input.job.sourceMediaProvider === "spotify"
      ? input.job.sourceMediaProvider
      : detectSourceMediaProvider(input.job.sourceMediaUrl);
  const sourceAudioMode = sourceMediaAudioPolicy(sourceMediaProvider);
  const subjectName =
    trimOrNull(input.job.subjectName) ??
    (input.job.requestKind === "bedtime_story"
      ? "Bedtime Story"
      : input.job.requestKind === "music_video"
        ? "Music Video Brief"
        : input.job.requestKind === "scene_recreation"
          ? "Scene Recreation Brief"
          : "HashCinema Brief");
  const subjectDescription = trimOrNull(input.job.subjectDescription);
  const sourceTranscript = trimOrNull(input.job.sourceTranscript);
  const narrativeSummary = buildNarrativeSummary(input.job);
  const storyCards = buildStoryCards({
    requestKind: input.job.requestKind,
    subjectName,
    subjectDescription,
    requestedPrompt: trimOrNull(input.job.requestedPrompt),
    sourceTranscript,
    storyBeats: null,
    audioEnabled:
      sourceAudioMode === "source_track"
        ? false
        : typeof input.job.audioEnabled === "boolean"
          ? input.job.audioEnabled
          : input.job.requestKind === "bedtime_story" ||
              input.job.requestKind === "music_video" ||
              input.job.requestKind === "scene_recreation",
  });
  const storyBeats = buildStoryBeats({
    job: input.job,
    storyCards,
  });
  const continuationPrompt = buildContinuationPrompt({
    requestKind: input.job.requestKind,
    subjectName,
    subjectDescription,
    requestedPrompt: trimOrNull(input.job.requestedPrompt),
    sourceTranscript,
    storyBeats,
  });
  const behaviorPatterns = buildBehaviorPatterns(input.job, style.label);
  const funObservations = buildFunObservations(input.job);
  const memorableMoments = buildMemorableMoments(input.job);
  const audioEnabled =
    sourceAudioMode === "source_track"
      ? false
      : typeof input.job.audioEnabled === "boolean"
        ? input.job.audioEnabled
        : input.job.requestKind === "bedtime_story" ||
            input.job.requestKind === "music_video" ||
            input.job.requestKind === "scene_recreation";
  const worldbuilder = buildTianezhaWorldbuilder({
    storyKind: input.job.requestKind,
    subjectName,
    subjectDescription,
    requestedPrompt: trimOrNull(input.job.requestedPrompt),
    sourceMediaUrl: input.job.sourceMediaUrl,
    sourceMediaProvider,
    sourceTranscript,
    audioEnabled,
  });

  const story: WalletStory = {
    wallet: input.job.wallet,
    storyKind: input.job.requestKind,
    pricingMode: input.job.pricingMode,
    visibility: input.job.visibility,
    experience: input.job.experience,
    subjectName,
    subjectDescription,
    sourceMediaUrl: input.job.sourceMediaUrl ?? null,
    sourceEmbedUrl: input.job.sourceEmbedUrl ?? null,
    sourceMediaProvider,
    sourceTranscript,
    stylePreset: style.id,
    styleLabel: style.label,
    requestedPrompt: trimOrNull(input.job.requestedPrompt),
    audioEnabled,
    storyCards,
    continuationPrompt,
    rangeDays: input.job.rangeDays,
    packageType: input.job.packageType,
    durationSeconds: input.job.videoSeconds,
    analytics: {
      pumpTokensTraded: 0,
      buyCount: 0,
      sellCount: 0,
      solSpent: 0,
      solReceived: 0,
      estimatedPnlSol: 0,
      bestTrade: "Story brief established",
      worstTrade: "No market tape involved",
      styleClassification: style.label,
    },
    timeline: [],
    walletPersonality:
      input.job.requestKind === "bedtime_story"
        ? "Gentle bedtime narrator"
        : input.job.requestKind === "music_video"
          ? "Music video director"
          : input.job.requestKind === "scene_recreation"
            ? "Scene recreation editor"
            : "Prompt-led story architect",
    behaviorPatterns,
    memorableMoments,
    funObservations,
    narrativeSummary,
    storyBeats,
    worldbuilder,
    tokenMetadata: [],
  };

  const report: Omit<ReportDocument, "summary" | "downloadUrl"> = {
    jobId: input.job.jobId,
    wallet: input.job.wallet,
    rangeDays: input.job.rangeDays,
    subjectKind: input.job.requestKind,
    pricingMode: input.job.pricingMode,
    visibility: input.job.visibility,
    experience: input.job.experience,
    moderationStatus: input.job.moderationStatus,
    creatorId: input.job.creatorId ?? null,
    creatorEmail: input.job.creatorEmail ?? null,
    subjectName,
    subjectDescription,
    sourceMediaUrl: input.job.sourceMediaUrl ?? null,
    sourceEmbedUrl: input.job.sourceEmbedUrl ?? null,
    sourceMediaProvider,
    sourceTranscript,
    stylePreset: style.id,
    styleLabel: style.label,
    durationSeconds: input.job.videoSeconds,
    audioEnabled: story.audioEnabled,
    storyCards,
    continuationPrompt,
    pumpTokensTraded: 0,
    buyCount: 0,
    sellCount: 0,
    solSpent: 0,
    solReceived: 0,
    estimatedPnlSol: 0,
    bestTrade: "Story brief established",
    worstTrade: "No market tape involved",
    styleClassification: style.label,
    timeline: [],
    walletPersonality: story.walletPersonality,
    behaviorPatterns,
    memorableMoments,
    funObservations,
    narrativeSummary,
    storyBeats,
    worldbuilder,
  };

  return {
    report,
    story,
  };
}
