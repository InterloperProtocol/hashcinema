import { ACTIVE_PACKAGE_TYPES, PACKAGE_CONFIG } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { TOKEN_VIDEO_STYLE_PRESETS } from "@/lib/memecoins/styles";
import { createHashCinemaX402Adapter } from "@/packages/adapters/src/payments/x402";
import { InterfaceAdapterServiceManifest } from "@/packages/core/src/protocol";

export function getHashCinemaServiceManifest(): InterfaceAdapterServiceManifest {
  const env = getEnv();
  const baseUrl = env.APP_BASE_URL;

  return {
    id: "hashcinema.multichain-memecoin-video",
    name: "HashCinema",
    summary:
      "Multichain memecoin video generation from a single mint or contract address with manual SOL checkout or x402/USDC settlement.",
    primaryMode: "token_video",
    supportedChains: ["solana", "ethereum", "bsc", "base"],
    inputSchema: {
      addressField: "tokenAddress",
      chainField: "chain",
      promptField: "requestedPrompt",
      styleField: "stylePreset",
    },
    packages: ACTIVE_PACKAGE_TYPES.map((packageType) => {
      const pkg = PACKAGE_CONFIG[packageType];
      return {
        packageType,
        label: pkg.label ?? packageType,
        durationSeconds: pkg.videoSeconds,
        priceSol: pkg.priceSol,
        priceUsdc: pkg.priceUsdc,
      };
    }),
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
        endpoint: new URL("/api/jobs", baseUrl).toString(),
      },
      createHashCinemaX402Adapter(baseUrl),
    ],
    endpoints: {
      createJob: new URL("/api/jobs", baseUrl).toString(),
      x402: new URL("/api/x402/video", baseUrl).toString(),
      statusTemplate: new URL("/api/jobs/{jobId}", baseUrl).toString(),
      manifest: new URL("/api/service", baseUrl).toString(),
    },
  };
}
