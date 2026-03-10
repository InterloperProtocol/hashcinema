import { JobDocument } from "@/lib/types/domain";
import {
  createSolanaPayUrl,
  getPlatformPaymentWallet,
  lamportsToSol,
  solToLamports,
} from "@/lib/payments/solana-pay";

export interface PaymentInstructions {
  paymentWallet: string;
  memo: string;
  requiredLamports: number;
  receivedLamports: number;
  remainingLamports: number;
  amountSol: number;
  receivedSol: number;
  remainingSol: number;
  solanaPayUrl: string;
}

export function buildPaymentInstructions(job: JobDocument): PaymentInstructions {
  const paymentWallet = getPlatformPaymentWallet();
  const requiredLamports = job.requiredLamports ?? solToLamports(job.priceSol);
  const receivedLamports = Math.max(0, job.receivedLamports ?? 0);
  const remainingLamports = Math.max(requiredLamports - receivedLamports, 0);
  const remainingSol = lamportsToSol(remainingLamports);
  const amountSol = lamportsToSol(requiredLamports);
  const receivedSol = lamportsToSol(receivedLamports);

  const solanaPayAmount = remainingLamports > 0 ? remainingSol : amountSol;

  return {
    paymentWallet,
    memo: job.jobId,
    requiredLamports,
    receivedLamports,
    remainingLamports,
    amountSol,
    receivedSol,
    remainingSol,
    solanaPayUrl: createSolanaPayUrl({
      amountSol: solanaPayAmount,
      memo: job.jobId,
      label: "HASHCINEMA",
      message: "Generate Wallet Cinema",
    }),
  };
}
