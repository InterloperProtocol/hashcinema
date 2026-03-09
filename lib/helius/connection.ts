import { getEnv } from "@/lib/env";
import { Connection } from "@solana/web3.js";

let cachedPrimaryConnection: Connection | null = null;
let cachedFallbackConnection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (cachedPrimaryConnection) {
    return cachedPrimaryConnection;
  }

  const env = getEnv();
  cachedPrimaryConnection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  return cachedPrimaryConnection;
}

export function getSolanaFallbackConnection(): Connection {
  if (cachedFallbackConnection) {
    return cachedFallbackConnection;
  }

  const env = getEnv();
  cachedFallbackConnection = new Connection(
    env.SOLANA_RPC_FALLBACK_URL,
    "confirmed",
  );
  return cachedFallbackConnection;
}

export async function withSolanaRpcFallback<T>(
  execute: (connection: Connection) => Promise<T>,
): Promise<T> {
  const primary = getSolanaConnection();

  try {
    return await execute(primary);
  } catch (primaryError) {
    const env = getEnv();

    // Avoid duplicate retry when both URLs are the same.
    if (env.SOLANA_RPC_URL === env.SOLANA_RPC_FALLBACK_URL) {
      throw primaryError;
    }

    const fallback = getSolanaFallbackConnection();
    return execute(fallback);
  }
}

