import { SEED_WALLET_PROFILES } from "@/lib/analytics/constants";
import { scoreMetrics } from "@/lib/analytics/scoreMetrics";
import { scoreModifiers } from "@/lib/analytics/scoreModifiers";
import { scorePersonality } from "@/lib/analytics/scorePersonality";
import { selectMoments } from "@/lib/analytics/selectMoments";

describe("analytics scoring boundaries", () => {
  it("scores personality/modifiers and emits relevant moments", () => {
    const seed = SEED_WALLET_PROFILES[0]!;
    const metrics = scoreMetrics({
      normalizedTrades: seed.normalizedTrades,
      rangeHours: seed.rangeHours,
    });

    const personality = scorePersonality({ metrics });
    const modifiers = scoreModifiers({ metrics });
    const moments = selectMoments({
      normalizedTrades: seed.normalizedTrades,
      metrics,
    });

    expect(personality.primary.displayName.length).toBeGreaterThan(0);
    expect(modifiers.length).toBeGreaterThanOrEqual(2);
    expect(modifiers.length).toBeLessThanOrEqual(4);
    expect(Object.keys(moments).length).toBeLessThanOrEqual(12);
  });

  it("returns empty moment set for no trades", () => {
    const metrics = scoreMetrics({
      normalizedTrades: [],
      rangeHours: 24,
    });
    const moments = selectMoments({
      normalizedTrades: [],
      metrics,
    });
    expect(moments).toEqual({});
  });
});

