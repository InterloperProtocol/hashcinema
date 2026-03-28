import { SupportedTokenChain, VideoStyleId } from "@/lib/types/domain";

export interface InterfacePaymentAdapter {
  id: string;
  label: string;
  kind: "manual" | "x402";
  currency: "SOL" | "USDC";
  network: "solana";
  endpoint: string;
}

export interface InterfacePackageQuote {
  packageType: "1d" | "2d";
  label: string;
  durationSeconds: number;
  priceSol: number;
  priceUsdc: number;
}

export interface InterfaceStyleOption {
  id: VideoStyleId;
  label: string;
  summary: string;
}

export interface InterfaceAdapterServiceManifest {
  id: string;
  name: string;
  summary: string;
  primaryMode: "token_video";
  supportedChains: SupportedTokenChain[];
  inputSchema: {
    addressField: "tokenAddress";
    chainField: "chain";
    promptField: "requestedPrompt";
    styleField: "stylePreset";
  };
  packages: InterfacePackageQuote[];
  styles: InterfaceStyleOption[];
  adapters: InterfacePaymentAdapter[];
  endpoints: {
    createJob: string;
    x402: string;
    statusTemplate: string;
    manifest: string;
  };
}
