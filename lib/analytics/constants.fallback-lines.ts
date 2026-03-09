import { InterpretationLineTemplate, NarrativeTemplate, TextTemplate } from "./types";

export const FALLBACK_INTERPRETATION_LINES: InterpretationLineTemplate[] = [
  { id: "buys-excitement", text: "This wallet buys excitement and sells discomfort.", tags: ["chaos"], suitabilityRules: [{ metricPath: "behavior.chaosScore", op: "gte", value: 0.45, weight: 1.2 }], tone: "playful-drag" },
  { id: "conviction-weak-exits", text: "Strong convictions, weaker exits.", tags: ["conviction", "paper-hands"], suitabilityRules: [{ metricPath: "behavior.convictionScore", op: "gte", value: 0.55, weight: 1 }, { metricPath: "holding.shortHoldBias", op: "gte", value: 0.35, weight: 1 }], tone: "dry" },
  { id: "market-owed", text: "You traded like the market personally owed you a comeback.", tags: ["revenge"], suitabilityRules: [{ metricPath: "timing.rapidReentryScore", op: "gte", value: 0.4, weight: 1.2 }], tone: "affectionate-drag" },
  { id: "respected-momentum", text: "The wallet respected nothing except momentum.", tags: ["momentum"], suitabilityRules: [{ metricPath: "attention.chaseScore", op: "gte", value: 0.5, weight: 1 }], tone: "trenches" },
  { id: "escalating-events", text: "This was less a strategy and more a sequence of escalating emotional events.", tags: ["chaos"], suitabilityRules: [{ metricPath: "behavior.chaosScore", op: "gte", value: 0.5, weight: 1.2 }], tone: "cinematic" },
  { id: "village-logoff", text: "Village elder would have told you to log off.", tags: ["village", "night"], suitabilityRules: [{ metricPath: "timing.nightActivityScore", op: "gte", value: 0.35, weight: 1.1 }], tone: "village" },
  { id: "renting-property", text: "This chart had you emotionally renting property.", tags: ["baghold"], suitabilityRules: [{ metricPath: "holding.bagholdBias", op: "gte", value: 0.35, weight: 1.1 }], tone: "painfully-specific" },
  { id: "arguing-fate", text: "You were not trading. You were arguing with fate.", tags: ["drama"], suitabilityRules: [{ metricPath: "virality.cinemaScore", op: "gte", value: 0.5, weight: 1.2 }], tone: "dramatic" },
  { id: "fomo-tax", text: "You kept paying the FOMO tax with premium urgency.", tags: ["fomo"], suitabilityRules: [{ metricPath: "timing.lateEntryBias", op: "gte", value: 0.4, weight: 1.2 }], tone: "trenches" },
  { id: "group-chat-entries", text: "Execution looked like a group chat voted on every entry.", tags: ["social"], suitabilityRules: [{ metricPath: "attention.attentionSensitivity", op: "gte", value: 0.5, weight: 1 }], tone: "twitter-native" },
  { id: "overmanaged", text: "You did so much management the trade forgot what it was about.", tags: ["overcooked"], suitabilityRules: [{ metricPath: "activity.tradesPerHour", op: "gte", value: 1.25, weight: 1 }, { metricPath: "behavior.chaosScore", op: "gte", value: 0.5, weight: 1 }], tone: "mocking" },
  { id: "bag-mission", text: "You held that bag like it was a community mission statement.", tags: ["diamond", "baghold"], suitabilityRules: [{ metricPath: "holding.avgHoldMinutes", op: "gte", value: 120, weight: 1 }], tone: "village" },
  { id: "discipline-civilian", text: "Somehow, discipline showed up in civilian clothes.", tags: ["discipline"], suitabilityRules: [{ metricPath: "behavior.patienceScore", op: "gte", value: 0.55, weight: 1 }, { metricPath: "behavior.chaosScore", op: "lte", value: 0.45, weight: 1 }], tone: "backhanded-praise" },
  { id: "thread-before-candle", text: "You saw the thread before the candle and acted like a prophet.", tags: ["early", "meta"], suitabilityRules: [{ metricPath: "timing.earlyEntryBias", op: "gte", value: 0.5, weight: 1 }], tone: "praise" },
  { id: "accidental-copypasta", text: "This entire session reads like accidental copypasta.", tags: ["viral"], suitabilityRules: [{ metricPath: "virality.memeabilityScore", op: "gte", value: 0.5, weight: 1.1 }], tone: "viral" },
];

export const FALLBACK_TRENCH_COPYPASTA: TextTemplate[] = [
  { id: "need-price-up", trigger: "general", text: "I need price to go up." },
  { id: "one-more-trade", trigger: "revenge", text: "One more trade. Just one more." },
  { id: "dip-not-done", trigger: "averaging", text: "The dip was, in fact, not done dipping." },
  { id: "dev-left", trigger: "rug", text: "Dev said community coin. Dev also left." },
  { id: "village-warned", trigger: "late-entry", text: "Village people warned you. You still clicked buy." },
  { id: "unc-sold", trigger: "baghold", text: "Unc would have sold. You bonded spiritually." },
  { id: "emotional-agriculture", trigger: "chaos", text: "This was not alpha. This was emotional agriculture." },
  { id: "hero-to-uncle", trigger: "paper-hands", text: "You entered like a hero and exited like a tired uncle." },
  { id: "brother-cinema", trigger: "cinema", text: "Brother this was cinema." },
  { id: "whole-village", trigger: "viral", text: "Whole village saw this one." },
];

export const FALLBACK_CINEMATIC_SUMMARIES: NarrativeTemplate[] = [
  { id: "cinema-chaos", tone: "chaotic", text: "In {rangeHours}h, {walletShort} turned {tradeCount} trades into trench cinema. {personality} arc, {modifierOne} side effects, zero emotional seatbelt.", tags: ["chaos", "cinema"] },
  { id: "cinema-conviction", tone: "dramatic", text: "{walletShort} ran a conviction arc: {personality}, {modifierOne}, and repeated negotiations with fate.", tags: ["conviction", "drama"] },
  { id: "cinema-survival", tone: "battle-tested", text: "What started as noise became a survival story. {walletShort} posted {tradeCount} decisions and found a replay-worthy ending.", tags: ["survival"] },
  { id: "cinema-village", tone: "village", text: "Village bulletin: {walletShort} traded {tradeCount} times in {rangeHours}h, powered by {personality}. Screenshots were secured.", tags: ["village"] },
];

export const FALLBACK_X_LINES: NarrativeTemplate[] = [
  { id: "x-cinema", text: "This wallet did not trade. It produced episodes.", tags: ["cinema", "viral"] },
  { id: "x-fate", text: "You were not managing risk, you were debating fate in public.", tags: ["drama"] },
  { id: "x-late", text: "Somewhere a late entry got paid. It just was not you.", tags: ["late", "roast"] },
  { id: "x-village", text: "Village court reviewed this chart and requested one full day offline.", tags: ["village"] },
  { id: "x-overcooked", text: "You over-managed the trade until it filed for emotional bankruptcy.", tags: ["overcooked"] },
  { id: "x-conviction", text: "Conviction levels: elite. Exit coordination: negotiable.", tags: ["conviction"] },
  { id: "x-chaos", text: "Every candle got a response. None of them asked for one.", tags: ["chaos"] },
  { id: "x-comeback", text: "You treated losses like warmups for the sequel.", tags: ["comeback"] },
  { id: "x-fomo", text: "FOMO entered the room first. Risk controls arrived later.", tags: ["fomo"] },
  { id: "x-folklore", text: "This wallet is one screenshot away from trench folklore.", tags: ["viral"] },
];
