import { analyzeSeedWalletProfile, getSeedWalletProfiles } from "@/lib/analytics";
import { walletAnalysisResultSchema } from "@/lib/analytics/schemas";

describe("analytics seed determinism", () => {
  it("returns valid and deterministic analysis for all seed profiles", async () => {
    const seeds = getSeedWalletProfiles();
    expect(seeds).toHaveLength(5);

    for (const seed of seeds) {
      const first = await analyzeSeedWalletProfile(seed.id);
      const second = await analyzeSeedWalletProfile(seed.id);

      expect(walletAnalysisResultSchema.parse(first)).toEqual(first);
      expect(second).toEqual(first);
    }
  });
});

