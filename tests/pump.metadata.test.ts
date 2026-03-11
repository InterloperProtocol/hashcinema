import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getPumpMetadata: vi.fn(),
  upsertPumpMetadata: vi.fn(),
  fetchWithTimeout: vi.fn(),
  getAsset: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/lib/jobs/repository", () => ({
  getPumpMetadata: mocks.getPumpMetadata,
  upsertPumpMetadata: mocks.upsertPumpMetadata,
}));

vi.mock("@/lib/network/http", () => ({
  fetchWithTimeout: mocks.fetchWithTimeout,
}));

vi.mock("@/lib/helius/client", () => ({
  getHeliusClient: () => ({
    getAsset: mocks.getAsset,
  }),
}));

vi.mock("@/lib/logging/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

vi.mock("@/lib/network/retry", () => {
  class RetryableError extends Error {}

  return {
    RetryableError,
    isRetryableHttpStatus: (status: number) => status >= 500,
    withRetry: async <T>(fn: () => Promise<T>) => fn(),
  };
});

describe("pump metadata resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPumpMetadata.mockResolvedValue(null);
    mocks.upsertPumpMetadata.mockResolvedValue(undefined);
  });

  it("falls back to Helius when Pump.fun responds with server errors", async () => {
    mocks.fetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 530,
    });
    mocks.getAsset.mockResolvedValue({
      content: {
        metadata: {
          name: "Sample Token",
          symbol: "SAMPLE",
          description: "desc",
        },
        links: {
          image: "https://cdn.example.com/image.png",
        },
        json_uri: "https://cdn.example.com/metadata.json",
      },
    });

    const { getOrFetchPumpMetadata } = await import("@/lib/pump/metadata");
    const result = await getOrFetchPumpMetadata("8opvqaWysX1oYbXuTL8PHaoaTiXD69VFYAX4smPebonk");

    expect(result.name).toBe("Sample Token");
    expect(result.symbol).toBe("SAMPLE");
    expect(result.image).toBe("https://cdn.example.com/image.png");
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "pumpfun_metadata_fetch_failed",
      expect.objectContaining({
        component: "pump_metadata",
        stage: "fetch_pumpfun_metadata",
      }),
    );
  });

  it("returns deterministic fallback metadata when both providers fail", async () => {
    mocks.fetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 530,
    });
    mocks.getAsset.mockRejectedValue(new Error("helius unavailable"));

    const { getOrFetchPumpMetadata } = await import("@/lib/pump/metadata");
    const mint = "8opvqaWysX1oYbXuTL8PHaoaTiXD69VFYAX4smPebonk";
    const result = await getOrFetchPumpMetadata(mint);

    expect(result.name).toBe(mint.slice(0, 6));
    expect(result.symbol).toBe("UNKNOWN");
    expect(result.image).toBeNull();
    expect(result.description).toBeNull();
  });

  it("uses DexScreener token metadata when Pump.fun fails", async () => {
    const mint = "H3kZDLodPNMwcy4sRZKBQySqhKZ3c7K3SAphVYnSpump";
    mocks.fetchWithTimeout.mockImplementation(async (url: string) => {
      if (url.includes("frontend-api.pump.fun")) {
        return { ok: false, status: 530 };
      }

      if (url.includes("api.dexscreener.com/tokens/v1/solana/")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              dexId: "pumpfun",
              baseToken: {
                address: mint,
                name: "No Sense Coin",
                symbol: "NoSense",
              },
              volume: { h24: 8536.72 },
            },
          ],
        };
      }

      return { ok: false, status: 404 };
    });
    mocks.getAsset.mockResolvedValue({
      content: {
        metadata: {},
        links: {},
      },
    });

    const { getOrFetchPumpMetadata } = await import("@/lib/pump/metadata");
    const result = await getOrFetchPumpMetadata(mint);

    expect(result.name).toBe("No Sense Coin");
    expect(result.symbol).toBe("NoSense");
    expect(result.isPump).toBe(true);
  });
});
