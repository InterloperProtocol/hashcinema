import { applyPaymentSettlement } from "@/lib/payments/settlement";

describe("payment settlement", () => {
  it("marks partial payments as payment_detected and tracks remaining", () => {
    const result = applyPaymentSettlement(
      {
        status: "awaiting_payment",
        requiredLamports: 40_000_000,
        receivedLamports: 0,
        paymentSignatures: [],
        txSignature: null,
      },
      {
        signature: "sig-1",
        lamports: 10_000_000,
      },
    );

    expect(result.duplicate).toBe(false);
    expect(result.newlyConfirmed).toBe(false);
    expect(result.next.status).toBe("payment_detected");
    expect(result.next.receivedLamports).toBe(10_000_000);
    expect(result.remainingLamports).toBe(30_000_000);
  });

  it("confirms job once cumulative payments meet required lamports", () => {
    const first = applyPaymentSettlement(
      {
        status: "awaiting_payment",
        requiredLamports: 40_000_000,
        receivedLamports: 0,
        paymentSignatures: [],
        txSignature: null,
      },
      {
        signature: "sig-1",
        lamports: 15_000_000,
      },
    );

    const second = applyPaymentSettlement(first.next, {
      signature: "sig-2",
      lamports: 25_000_000,
    });

    expect(second.duplicate).toBe(false);
    expect(second.newlyConfirmed).toBe(true);
    expect(second.next.status).toBe("payment_confirmed");
    expect(second.next.receivedLamports).toBe(40_000_000);
    expect(second.remainingLamports).toBe(0);
  });

  it("ignores duplicate signatures", () => {
    const state = {
      status: "payment_detected" as const,
      requiredLamports: 40_000_000,
      receivedLamports: 20_000_000,
      paymentSignatures: ["sig-1"],
      txSignature: "sig-1",
    };

    const duplicate = applyPaymentSettlement(state, {
      signature: "sig-1",
      lamports: 20_000_000,
    });

    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.next.receivedLamports).toBe(20_000_000);
    expect(duplicate.newlyConfirmed).toBe(false);
  });
});
