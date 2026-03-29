import type { JobRequestKind, TianezhaTestVerdict, TianezhaWorldbuilderState } from "@/lib/types/domain";
import { detectSourceMediaProvider, sourceMediaAudioPolicy } from "@/lib/cinema/sourceMedia";

const KNOWLEDGE_BASE = [
  "poly-manifold: manifold optimization, Euclidean geometry, Sphere, and SPD constraints",
  "Awesome Physics Cognition-based Video Generation: physics-aware video generation survey and world-model map",
  "NewtonGen: controllable text-to-video with Newtonian dynamics and motion control",
];

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function clampSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function kindLabel(kind?: JobRequestKind): string {
  switch (kind) {
    case "bedtime_story":
      return "bedtime world";
    case "music_video":
      return "music video manifold";
    case "scene_recreation":
      return "scene recreation manifold";
    case "token_video":
      return "trading lore manifold";
    default:
      return "cinema manifold";
  }
}

function baseSubject(input: {
  storyKind?: JobRequestKind;
  subjectName?: string | null;
  sourceMediaUrl?: string | null;
  sourceMediaProvider?: string | null;
}): string {
  const title = trimOrNull(input.subjectName);
  if (title) {
    return title;
  }

  if (input.sourceMediaProvider === "youtube" || detectSourceMediaProvider(input.sourceMediaUrl)) {
    return "YouTube source";
  }

  if (input.sourceMediaProvider === "spotify") {
    return "Spotify source";
  }

  return kindLabel(input.storyKind);
}

function buildManifold(input: {
  storyKind?: JobRequestKind;
  sourceMediaProvider?: string | null;
}): TianezhaWorldbuilderState["manifold"] {
  const sourceAware = input.sourceMediaProvider === "youtube" || input.sourceMediaProvider === "spotify";
  const baseRules = [
    "Keep the opening anchor readable before the cut accelerates.",
    "Preserve emotional continuity between beats instead of jumping in texture.",
    "Close on a frame that can be remembered without extra explanation.",
  ];

  if (input.storyKind === "bedtime_story") {
    return {
      anchorPoints: ["soft opening", "gentle middle", "quiet landing"],
      tangentVectors: [
        "warm light drift",
        "narration-led motion",
        "comfort-first resolution",
      ],
      continuityRules: [
        "No sudden tension spikes.",
        "Keep the music bed very light and classical.",
        "End with a rest signal rather than a cliffhanger.",
      ],
    };
  }

  if (input.storyKind === "music_video") {
    return {
      anchorPoints: ["track identity", "beat ride", "chorus lift", "poster landing"],
      tangentVectors: [
        sourceAware ? "source track attachment" : "performance camera swing",
        "chorus-scale escalation",
        "tour-poster frame lock",
      ],
      continuityRules: sourceAware
        ? [
            "No synthetic replacement for the provided source audio.",
            "Use the link as the track spine and keep the visual cut beat-aware.",
            "Treat the source link as an external source track to be muxed later.",
          ]
        : [
            "Let the beat drive the edit.",
            "Keep the performance language central.",
            "Leave room for the chorus to hit hard.",
          ],
    };
  }

  if (input.storyKind === "scene_recreation") {
    return {
      anchorPoints: ["source scene", "dialogue spine", "rebuild turn", "remembered frame"],
      tangentVectors: [
        sourceAware ? "source reference attachment" : "blocking preservation",
        "dialogue cadence lock",
        "trailer-grade escalation",
      ],
      continuityRules: sourceAware
        ? [
            "No synthetic audio if the source link can be used as the track spine.",
            "Preserve the source scene's timing and emotional shape.",
            "Treat the provided link as the anchor, not an optional citation.",
          ]
        : [
            "Keep the dialogue cadence visible in the edit.",
            "Preserve blocking while changing the skin.",
            "Hold onto the emotional spine of the scene.",
          ],
    };
  }

  return {
    anchorPoints: ["opening premise", "middle escalation", "final landing"],
    tangentVectors: [
      "world introduction",
      "character pressure",
      "memorable final image",
    ],
    continuityRules: baseRules,
  };
}

function buildStoryline(input: {
  storyKind?: JobRequestKind;
  subjectName?: string | null;
  subjectDescription?: string | null;
  requestedPrompt?: string | null;
  sourceMediaUrl?: string | null;
  sourceMediaProvider?: string | null;
  sourceTranscript?: string | null;
}): string[] {
  const subject = baseSubject(input);
  const description = trimOrNull(input.subjectDescription);
  const prompt = trimOrNull(input.requestedPrompt);
  const transcript = trimOrNull(input.sourceTranscript);
  const sourceUrl = trimOrNull(input.sourceMediaUrl);
  const sourceLine =
    sourceUrl && (input.sourceMediaProvider === "youtube" || input.sourceMediaProvider === "spotify")
      ? `Source link: ${input.sourceMediaProvider} source folded into the world spine.`
      : sourceUrl
        ? "Source link: external media folded into the world spine."
        : null;
  const transcriptLine = transcript
    ? `Transcript spine: ${transcript.split(/\r?\n+/).slice(0, 2).join(" ")}`
    : null;

  const opening =
    input.storyKind === "bedtime_story"
      ? `${subject} opens as a calm, safe world that can wind down without spikes.`
      : input.storyKind === "music_video"
        ? `${subject} opens on the track identity and the hook that controls the cut.`
        : input.storyKind === "scene_recreation"
          ? `${subject} opens by naming the source scene and the emotional promise it carries.`
          : `${subject} opens as a cinematic brief with a clean visual premise.`;

  const middle =
    input.storyKind === "bedtime_story"
      ? "The middle stays warm, readable, and reassuring while the movement stays soft."
      : input.storyKind === "music_video"
        ? "The middle rides the beat, the chorus, or the performance details without losing the subject lock."
        : input.storyKind === "scene_recreation"
          ? "The middle preserves dialogue cadence and blocking rhythm while reshaping the skin."
          : "The middle raises motion, scale, and tension while keeping the subject identity intact.";

  const turn =
    input.storyKind === "bedtime_story"
      ? "The turn lands on comfort, not surprise, and keeps the bedtime promise intact."
      : input.storyKind === "music_video"
        ? "The turn blooms into a chorus-sized visual move designed for replay."
        : input.storyKind === "scene_recreation"
          ? "The turn becomes a trailer-grade reinterpretation that stays faithful but sharper."
          : "The turn escalates into a memorable payoff that still feels coherent.";

  const landing =
    input.storyKind === "bedtime_story"
      ? "The landing is soft, quiet, and clearly ready for rest."
      : input.storyKind === "music_video"
        ? "The landing feels like a poster, playlist cover, or tour card."
        : input.storyKind === "scene_recreation"
          ? "The landing feels like a remembered scene rebuilt at higher voltage."
          : "The landing leaves an image worth sharing without extra explanation.";

  return [opening, middle, turn, landing, sourceLine, transcriptLine, description, prompt]
    .filter(Boolean)
    .map((line) => clampSentence(line as string));
}

function buildTests(input: {
  storyKind?: JobRequestKind;
  sourceMediaProvider?: string | null;
  sourceTranscript?: string | null;
  audioEnabled?: boolean | null;
  sourceMediaUrl?: string | null;
}): TianezhaWorldbuilderState["tests"] {
  const sourceAudioMode = sourceMediaAudioPolicy(
    input.sourceMediaProvider === "youtube" || input.sourceMediaProvider === "spotify"
      ? (input.sourceMediaProvider as "youtube" | "spotify")
      : null,
  );
  const hasTranscript = Boolean(trimOrNull(input.sourceTranscript));
  const sourceLink = trimOrNull(input.sourceMediaUrl);
  const tests: TianezhaWorldbuilderState["tests"] = [
    {
      name: "continuity",
      verdict: "pass",
      detail: "The storyline keeps the subject spine, middle turn, and landing frame in one continuous arc.",
    },
  ];

  if (input.storyKind === "bedtime_story") {
    tests.push({
      name: "audio-policy",
      verdict: input.audioEnabled === false ? "warn" : "pass",
      detail:
        "Bedtime mode should stay on very light classical music and soft narration so the cut can wind down cleanly.",
    });
  } else if (input.storyKind === "music_video" || input.storyKind === "scene_recreation") {
    if (sourceAudioMode === "source_track") {
      tests.push({
        name: "source-audio",
        verdict: sourceLink ? "pass" : "warn",
        detail:
          "Source-linked music or dialogue should stay external; the render should stay silent here and mux the source track later.",
      });
    } else {
      tests.push({
        name: "audio-policy",
        verdict: input.audioEnabled === false ? "warn" : "pass",
        detail:
          input.storyKind === "music_video"
            ? "Music video mode should remain beat-aware and performance-first."
            : "Scene recreation mode should preserve dialogue cadence and timing.",
      });
    }
  } else {
    tests.push({
      name: "audio-policy",
      verdict: input.audioEnabled === false ? "warn" : "pass",
      detail: "General cinema can stay visual-first unless the brief calls for a sound layer.",
    });
  }

  if (hasTranscript) {
    tests.push({
      name: "transcript",
      verdict: "pass",
      detail: "A transcript or lyric spine is present and can guide the storyline lock.",
    });
  } else if (sourceLink && input.storyKind !== "bedtime_story") {
    tests.push({
      name: "transcript",
      verdict: sourceAudioMode === "source_track" ? "warn" : "pass",
      detail:
        "No transcript was supplied, so the storyline uses the subject prompt and source link as the spine.",
    });
  }

  return tests;
}

function verdictFromTests(tests: TianezhaWorldbuilderState["tests"]): TianezhaTestVerdict {
  if (tests.some((test) => test.verdict === "fail")) {
    return "fail";
  }

  if (tests.some((test) => test.verdict === "warn")) {
    return "warn";
  }

  return "pass";
}

export function buildTianezhaWorldbuilder(input: {
  storyKind?: JobRequestKind;
  subjectName?: string | null;
  subjectDescription?: string | null;
  requestedPrompt?: string | null;
  sourceMediaUrl?: string | null;
  sourceMediaProvider?: string | null;
  sourceTranscript?: string | null;
  audioEnabled?: boolean | null;
}): TianezhaWorldbuilderState {
  const sourceMediaProvider =
    input.sourceMediaProvider === "youtube" || input.sourceMediaProvider === "spotify"
      ? input.sourceMediaProvider
      : detectSourceMediaProvider(input.sourceMediaUrl);
  const manifold = buildManifold({
    storyKind: input.storyKind,
    sourceMediaProvider,
  });
  const storyline = buildStoryline({
    storyKind: input.storyKind,
    subjectName: input.subjectName,
    subjectDescription: input.subjectDescription,
    requestedPrompt: input.requestedPrompt,
    sourceMediaUrl: input.sourceMediaUrl,
    sourceMediaProvider,
    sourceTranscript: input.sourceTranscript,
  });
  const tests = buildTests({
    storyKind: input.storyKind,
    sourceMediaProvider,
    sourceTranscript: input.sourceTranscript,
    audioEnabled: input.audioEnabled,
    sourceMediaUrl: input.sourceMediaUrl,
  });
  const verdict = verdictFromTests(tests);
  const worldName = baseSubject({
    storyKind: input.storyKind,
    subjectName: input.subjectName,
    sourceMediaUrl: input.sourceMediaUrl,
    sourceMediaProvider,
  });

  return {
    model: "tianezha",
    worldName,
    sourceKind: input.storyKind,
    knowledgeBase: KNOWLEDGE_BASE,
    manifold,
    storyline,
    tests,
    verdict,
    summary: clampSentence(
      `${worldName} is modeled as a ${kindLabel(input.storyKind)} with ${verdict === "pass" ? "clean continuity" : verdict === "warn" ? "minor guardrails" : "active guardrails"} and a ${sourceMediaAudioPolicy(sourceMediaProvider)} audio stance.`,
    ),
  };
}
