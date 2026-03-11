import { describe, expect, it, vi } from "vitest";

const VALID_WALLET = "D1CRgh1Ty3yjDwN9CkwtsRWKmsmKQ2BbRbtKvCTfAN8Z";
const VALID_MASTER_SEED =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function applyBaseEnv(): void {
  process.env.HELIUS_API_KEY = "test-helius";
  process.env.SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
  process.env.OPENROUTER_API_KEY = "test-openrouter";
  process.env.VIDEO_API_KEY = "test-video";
  process.env.FIREBASE_PROJECT_ID = "test-project";
  process.env.PAYMENT_MASTER_SEED_HEX = VALID_MASTER_SEED;
  process.env.HASHCINEMA_PAYMENT_WALLET = VALID_WALLET;
}

describe.sequential("environment validation", () => {
  it("accepts a valid Solana revenue wallet", async () => {
    vi.resetModules();
    applyBaseEnv();

    const { getEnv } = await import("@/lib/env");
    const env = getEnv();

    expect(env.HASHCINEMA_PAYMENT_WALLET).toBe(VALID_WALLET);
  });

  it("rejects an invalid Solana revenue wallet", async () => {
    vi.resetModules();
    applyBaseEnv();
    process.env.HASHCINEMA_PAYMENT_WALLET = "not-a-solana-wallet";

    const { getEnv } = await import("@/lib/env");

    expect(() => getEnv()).toThrow(/HASHCINEMA_PAYMENT_WALLET/);
  });
});
