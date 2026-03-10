import { JobStatus } from "@/lib/types/domain";

export interface PaymentSettlementState {
  status: JobStatus;
  requiredLamports: number;
  receivedLamports: number;
  paymentSignatures: string[];
  txSignature: string | null;
}

export interface PaymentSettlementResult {
  duplicate: boolean;
  newlyConfirmed: boolean;
  next: PaymentSettlementState;
  remainingLamports: number;
}

export function applyPaymentSettlement(
  state: PaymentSettlementState,
  payment: { signature: string; lamports: number },
): PaymentSettlementResult {
  const existingSignatures = new Set(state.paymentSignatures);
  if (
    state.status === "complete" ||
    state.status === "failed" ||
    state.status === "processing" ||
    existingSignatures.has(payment.signature)
  ) {
    return {
      duplicate: true,
      newlyConfirmed: false,
      next: state,
      remainingLamports: Math.max(state.requiredLamports - state.receivedLamports, 0),
    };
  }

  const addedLamports = Math.max(0, Math.floor(payment.lamports));
  const nextReceivedLamports = state.receivedLamports + addedLamports;
  const fullyPaid = nextReceivedLamports >= state.requiredLamports;

  let nextStatus = state.status;
  if (state.status === "awaiting_payment" || state.status === "payment_detected") {
    if (fullyPaid) {
      nextStatus = "payment_confirmed";
    } else if (nextReceivedLamports > 0) {
      nextStatus = "payment_detected";
    }
  }

  const nextSignatures = [...state.paymentSignatures, payment.signature];
  const next: PaymentSettlementState = {
    ...state,
    status: nextStatus,
    receivedLamports: nextReceivedLamports,
    paymentSignatures: nextSignatures,
    txSignature: payment.signature,
  };

  return {
    duplicate: false,
    newlyConfirmed: state.status !== "payment_confirmed" && nextStatus === "payment_confirmed",
    next,
    remainingLamports: Math.max(next.requiredLamports - next.receivedLamports, 0),
  };
}
