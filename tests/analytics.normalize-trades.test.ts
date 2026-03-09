import { normalizeTrades } from "@/lib/analytics/normalizeTrades";
import { PumpTradeLike } from "@/lib/analytics/types";

describe("normalizeTrades", () => {
  it("matches sells against FIFO buy lots and computes pnl/hold durations", () => {
    const trades: PumpTradeLike[] = [
      {
        timestamp: 1_000,
        signature: "buy-1",
        mint: "MINT",
        symbol: "AAA",
        side: "buy",
        tokenAmount: 100,
        solAmount: 1,
      },
      {
        timestamp: 1_200,
        signature: "buy-2",
        mint: "MINT",
        symbol: "AAA",
        side: "buy",
        tokenAmount: 100,
        solAmount: 2,
      },
      {
        timestamp: 1_600,
        signature: "sell-1",
        mint: "MINT",
        symbol: "AAA",
        side: "sell",
        tokenAmount: 150,
        solAmount: 3,
      },
    ];

    const normalized = normalizeTrades(trades);
    const sell = normalized.find((trade) => trade.signature === "sell-1");

    expect(normalized).toHaveLength(3);
    expect(sell?.pnlSol).toBeCloseTo(1, 8);
    expect(sell?.holdDurationMinutes).toBeCloseTo(8.8889, 3);
    expect(normalized.find((trade) => trade.signature === "buy-2")?.isOpenPosition).toBe(
      true,
    );
    expect(normalized.find((trade) => trade.signature === "buy-1")?.isOpenPosition).toBe(
      false,
    );
  });
});
