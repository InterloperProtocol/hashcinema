import { InterfacePaymentAdapter } from "@/packages/core/src/protocol";

export function createHashCinemaX402Adapter(baseUrl: string): InterfacePaymentAdapter {
  return {
    id: "hashcinema-x402",
    label: "x402 / USDC",
    kind: "x402",
    currency: "USDC",
    network: "solana",
    endpoint: new URL("/api/x402/video", baseUrl).toString(),
  };
}
