import { getEnv } from "@/lib/env";
import { createHelius } from "helius-sdk";

let cachedHelius: ReturnType<typeof createHelius> | null = null;

export function getHeliusClient() {
  if (cachedHelius) {
    return cachedHelius;
  }

  const env = getEnv();
  cachedHelius = createHelius({
    apiKey: env.HELIUS_API_KEY,
    network: "mainnet",
    userAgent: "hashcinema/1.0",
  });
  return cachedHelius;
}
