import { SupportedTokenChain, VideoStyleId } from "@/lib/types/domain";

export interface TokenVideoStylePreset {
  id: VideoStyleId;
  label: string;
  shortLabel: string;
  summary: string;
  directorNote: string;
  accent: string;
  promptSeed: string;
}

export const DEFAULT_TOKEN_VIDEO_STYLE_ID: VideoStyleId = "hyperflow_assembly";

export const TOKEN_VIDEO_STYLE_PRESETS: TokenVideoStylePreset[] = [
  {
    id: "hyperflow_assembly",
    label: "Hyperflow Assembly",
    shortLabel: "Hyperflow",
    summary: "A polished command-deck short with adapter-box UI energy and high-signal overlays.",
    directorNote:
      "Treat the token like an autonomous media service moving through a modular control room.",
    accent: "#98c8bf",
    promptSeed:
      "modular command surfaces, seafoam status lights, scanner glass, precision interface choreography",
  },
  {
    id: "trading_card",
    label: "Trading Card",
    shortLabel: "Card",
    summary: "A punchy token spotlight with collectible-card framing and stat-led reveals.",
    directorNote:
      "Frame the memecoin like a premium moving trading card with readable hero beats.",
    accent: "#ffd36d",
    promptSeed:
      "collectible foil textures, premium card framing, animated stat callouts, hero insert shots",
  },
  {
    id: "trench_neon",
    label: "Trench Neon",
    shortLabel: "Neon",
    summary: "A loud late-night memecoin trailer with club lighting, velocity, and zero chill.",
    directorNote:
      "Make it feel like the chart is a nightlife district and the token is the headliner.",
    accent: "#ff7647",
    promptSeed:
      "night market haze, neon strips, hectic lens motion, underground launch energy",
  },
  {
    id: "mythic_poster",
    label: "Mythic Poster",
    shortLabel: "Mythic",
    summary: "A bigger-than-life legend cut that treats the token like poster art in motion.",
    directorNote:
      "Push scale, iconography, and heroic composition without losing the token identity.",
    accent: "#f3c38f",
    promptSeed:
      "hero poster composition, epic negative space, glowing sigils, elevated myth branding",
  },
  {
    id: "glass_signal",
    label: "Glass Signal",
    shortLabel: "Glass",
    summary: "A clean translucent signal-feed look for understated but premium token stories.",
    directorNote:
      "Keep the pacing crisp and the UI translucent, like a future signal terminal.",
    accent: "#87dbff",
    promptSeed:
      "glassmorphism panels, clean telemetry, cool signal bloom, premium future terminal",
  },
];

const STYLE_BY_ID = new Map(
  TOKEN_VIDEO_STYLE_PRESETS.map((preset) => [preset.id, preset]),
);

export function getTokenVideoStylePreset(
  styleId?: VideoStyleId | null,
): TokenVideoStylePreset {
  return STYLE_BY_ID.get(styleId ?? DEFAULT_TOKEN_VIDEO_STYLE_ID) ??
    STYLE_BY_ID.get(DEFAULT_TOKEN_VIDEO_STYLE_ID)!;
}

export function listSuggestedStyleIds(input: {
  chain?: SupportedTokenChain | null;
  isPump?: boolean;
  description?: string | null;
}): VideoStyleId[] {
  const haystack = (input.description ?? "").toLowerCase();
  const suggestions = new Set<VideoStyleId>([DEFAULT_TOKEN_VIDEO_STYLE_ID]);

  if (input.isPump || input.chain === "solana") {
    suggestions.add("trench_neon");
  }

  if (input.chain === "ethereum" || haystack.includes("cult")) {
    suggestions.add("mythic_poster");
  }

  if (input.chain === "bsc" || haystack.includes("speed")) {
    suggestions.add("trading_card");
  }

  if (haystack.includes("ai") || haystack.includes("signal")) {
    suggestions.add("glass_signal");
  }

  for (const preset of TOKEN_VIDEO_STYLE_PRESETS) {
    suggestions.add(preset.id);
    if (suggestions.size >= 3) {
      break;
    }
  }

  return [...suggestions];
}
