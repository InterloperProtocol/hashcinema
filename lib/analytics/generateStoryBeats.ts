import { StoryBeat, WalletMetrics, WalletMoments } from "./types";

export function generateStoryBeats(input: {
  wallet: string;
  rangeHours: number;
  metrics: WalletMetrics;
  personality: { primary: { displayName: string } };
  modifiers: Array<{ displayName: string }>;
  moments: WalletMoments;
}): StoryBeat[] {
  const modifierOne = input.modifiers[0]?.displayName ?? "Chaotic Neutral";

  const beats: StoryBeat[] = [
    {
      phase: "opening",
      text: `${input.personality.primary.displayName} entered the window and started firing into Pump.fun with ${input.metrics.activity.tradeCount} decisions on the board.`,
      emotionalTone: "curious confidence",
      symbolicVisualHint: "phone glow in a dark room",
    },
    {
      phase: "rise",
      text:
        input.moments.mainCharacterMoment?.description ??
        "Momentum built and position sizing escalated as confidence warmed up.",
      emotionalTone: "adrenaline",
      symbolicVisualHint: "candles accelerating upward",
    },
    {
      phase: "damage",
      text:
        input.moments.fumbleMoment?.description ??
        `The tape pushed back, exposing ${modifierOne} behavior in real time.`,
      emotionalTone: "public pain",
      symbolicVisualHint: "red candles and frantic refreshes",
    },
    {
      phase: "pivot",
      text:
        input.moments.comebackMoment?.description ??
        input.moments.convictionMoment?.description ??
        "A hard pivot appeared as the wallet chose between panic and conviction.",
      emotionalTone: "determined uncertainty",
      symbolicVisualHint: "chart split between red and green",
    },
    {
      phase: "climax",
      text:
        input.moments.absoluteCinemaMoment?.description ??
        `Chaos peaked with a cinema score of ${input.metrics.virality.cinemaScore.toFixed(2)}.`,
      emotionalTone: "full cinema",
      symbolicVisualHint: "screenshot-worthy final candle",
    },
    {
      phase: "aftermath",
      text: `Window closes at ${input.metrics.pnl.estimatedPnlSol.toFixed(4)} SOL after ${input.rangeHours} hours of trench folklore generation.`,
      emotionalTone: "battle-worn clarity",
      symbolicVisualHint: "quiet chart and exhausted group chat",
    },
  ];

  return beats;
}
