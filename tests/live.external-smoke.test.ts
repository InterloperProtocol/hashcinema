import { describe, expect, it } from "vitest";
import { fetchWithTimeout } from "@/lib/network/http";
import { Connection } from "@solana/web3.js";

const runLive = process.env.RUN_LIVE_E2E === "1";
const describeLive = runLive ? describe : describe.skip;

describeLive("live external smoke", () => {
  it(
    "reaches configured Solana RPC",
    async () => {
      const rpcUrl =
        process.env.SOLANA_RPC_URL ?? process.env.SOLANA_RPC_FALLBACK_URL;
      if (!rpcUrl) {
        expect(true).toBe(true);
        return;
      }

      const connection = new Connection(rpcUrl, "confirmed");
      const slot = await connection.getSlot("confirmed");
      expect(slot).toBeGreaterThan(0);
    },
    30_000,
  );

  it(
    "resolves configured Helius webhook id when present",
    async () => {
      const apiKey = process.env.HELIUS_API_KEY;
      const webhookId = process.env.HELIUS_WEBHOOK_ID;
      if (!apiKey || !webhookId) {
        expect(true).toBe(true);
        return;
      }

      const response = await fetchWithTimeout(
        `https://api.helius.xyz/v0/webhooks/${encodeURIComponent(webhookId)}?api-key=${encodeURIComponent(apiKey)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
        12_000,
      );

      expect(response.ok).toBe(true);
      const payload = (await response.json()) as { webhookID?: string };
      expect(payload.webhookID).toBe(webhookId);
    },
    30_000,
  );

  it(
    "reaches DexScreener token API",
    async () => {
      const mint =
        process.env.LIVE_TEST_MINT ??
        "H3kZDLodPNMwcy4sRZKBQySqhKZ3c7K3SAphVYnSpump";
      const response = await fetchWithTimeout(
        `https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
        12_000,
      );

      expect(response.ok).toBe(true);
      const payload = (await response.json()) as unknown;
      expect(Array.isArray(payload)).toBe(true);
    },
    30_000,
  );
});
