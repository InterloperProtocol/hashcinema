import { ACTIVE_PACKAGE_TYPES, PACKAGE_CONFIG } from "@/lib/constants";
import { TOKEN_VIDEO_STYLE_PRESETS } from "@/lib/memecoins/styles";
import { InterfaceAdapterServiceManifest } from "@/packages/core/src/protocol";

export const publicHashCinemaServiceManifest: InterfaceAdapterServiceManifest = {
  id: "hashcinema.multichain-memecoin-video",
  name: "HashCinema",
  summary:
    "Multichain memecoin video generation from one mint or contract address, packaged for direct UI use or x402 agent calls.",
  primaryMode: "token_video",
  supportedChains: ["solana", "ethereum", "bsc", "base"],
  inputSchema: {
    addressField: "tokenAddress",
    chainField: "chain",
    promptField: "requestedPrompt",
    styleField: "stylePreset",
  },
  packages: ACTIVE_PACKAGE_TYPES.map((packageType) => ({
    packageType,
    label: PACKAGE_CONFIG[packageType].label ?? packageType,
    durationSeconds: PACKAGE_CONFIG[packageType].videoSeconds,
    priceSol: PACKAGE_CONFIG[packageType].priceSol,
    priceUsdc: PACKAGE_CONFIG[packageType].priceUsdc,
  })),
  styles: TOKEN_VIDEO_STYLE_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    summary: preset.summary,
  })),
  adapters: [
    {
      id: "hashcinema-manual-sol",
      label: "Manual SOL",
      kind: "manual",
      currency: "SOL",
      network: "solana",
      endpoint: "/api/jobs",
    },
    {
      id: "hashcinema-x402",
      label: "x402 / USDC",
      kind: "x402",
      currency: "USDC",
      network: "solana",
      endpoint: "/api/x402/video",
    },
  ],
  endpoints: {
    createJob: "/api/jobs",
    x402: "/api/x402/video",
    statusTemplate: "/api/jobs/{jobId}",
    manifest: "/api/service",
  },
};
