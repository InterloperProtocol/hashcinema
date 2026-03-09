import {
  extractMemo,
  hasSufficientPayment,
  transactionTargetsPlatformWallet,
} from "@/lib/payments/webhook";

vi.mock("@/lib/payments/solana-pay", () => ({
  getPlatformPaymentWallet: () => "PLATFORM_WALLET",
  solToLamports: (sol: number) => Math.round(sol * 1_000_000_000),
}));

describe("payment webhook helpers", () => {
  it("extracts memo from instruction payload", () => {
    const memo = extractMemo({
      instructions: [
        {
          programName: "memo",
          parsed: { memo: "job-123" },
        },
      ],
    });

    expect(memo).toBe("job-123");
  });

  it("falls back to memo in transaction description", () => {
    const memo = extractMemo({
      description: "Payment settled memo: job-xyz",
      instructions: [],
    });

    expect(memo).toBe("job-xyz");
  });

  it("checks platform wallet targeting and sufficient payment", () => {
    const tx = {
      nativeTransfers: [
        {
          fromUserAccount: "sender",
          toUserAccount: "PLATFORM_WALLET",
          amount: 25_000_000,
        },
      ],
    };

    expect(transactionTargetsPlatformWallet(tx)).toBe(true);
    expect(hasSufficientPayment({ tx, requiredPriceSol: 0.02 })).toBe(true);
    expect(hasSufficientPayment({ tx, requiredPriceSol: 0.03 })).toBe(false);
  });
});

