import { withSolanaRpcFallback } from "@/lib/helius/connection";
import {
  getJob,
  markPaymentConfirmed,
  markPaymentDetected,
  updateJob,
} from "@/lib/jobs/repository";
import { triggerJobProcessing } from "@/lib/jobs/trigger";
import {
  extractMemo,
  hasSufficientPayment,
  HeliusEnhancedWebhookTransaction,
  transactionTargetsPlatformWallet,
} from "@/lib/payments/webhook";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request-ip";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeWebhookPayload(
  payload: unknown,
): HeliusEnhancedWebhookTransaction[] {
  if (Array.isArray(payload)) {
    return payload as HeliusEnhancedWebhookTransaction[];
  }

  if (payload && typeof payload === "object") {
    const map = payload as Record<string, unknown>;
    if (Array.isArray(map.transactions)) {
      return map.transactions as HeliusEnhancedWebhookTransaction[];
    }
    return [payload as HeliusEnhancedWebhookTransaction];
  }

  return [];
}

async function isSignatureConfirmed(signature: string): Promise<boolean> {
  const status = await withSolanaRpcFallback((connection) =>
    connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    }),
  );

  const confirmation = status.value?.confirmationStatus;
  return (
    confirmation === "confirmed" ||
    confirmation === "finalized" ||
    status.value?.confirmations === null
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await enforceRateLimit({
      scope: "api_helius_webhook_post",
      key: ip,
      rules: [{ name: "webhook_per_minute", windowSec: 60, limit: 60 }],
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Rate limit exceeded",
          retryAfterSec: rateLimit.retryAfterSec,
          rule: rateLimit.exceededRule,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSec),
          },
        },
      );
    }

    const payload = await request.json();
    const transactions = normalizeWebhookPayload(payload);

    const results: Array<{
      signature: string | null;
      jobId: string | null;
      result:
        | "ignored"
        | "job_not_found"
        | "insufficient_amount"
        | "duplicate"
        | "confirmed";
    }> = [];

    for (const tx of transactions) {
      const signature = tx.signature ?? null;
      if (!signature || tx.transactionError) {
        results.push({ signature, jobId: null, result: "ignored" });
        continue;
      }

      if (!transactionTargetsPlatformWallet(tx)) {
        results.push({ signature, jobId: null, result: "ignored" });
        continue;
      }

      const memo = extractMemo(tx);
      if (!memo) {
        results.push({ signature, jobId: null, result: "ignored" });
        continue;
      }

      const job = await getJob(memo);
      if (!job) {
        results.push({ signature, jobId: memo, result: "job_not_found" });
        continue;
      }

      if (job.status === "complete" || job.status === "failed") {
        results.push({ signature, jobId: job.jobId, result: "duplicate" });
        continue;
      }

      if (job.status === "processing") {
        results.push({ signature, jobId: job.jobId, result: "duplicate" });
        continue;
      }

      if (job.status === "payment_confirmed") {
        await triggerJobProcessing(job.jobId);
        results.push({ signature, jobId: job.jobId, result: "confirmed" });
        continue;
      }

      if (
        job.status !== "awaiting_payment" &&
        job.status !== "payment_detected"
      ) {
        results.push({ signature, jobId: job.jobId, result: "duplicate" });
        continue;
      }

      if (
        job.status === "payment_detected" &&
        job.txSignature &&
        job.txSignature !== signature
      ) {
        results.push({ signature, jobId: job.jobId, result: "duplicate" });
        continue;
      }

      await markPaymentDetected(job.jobId, signature);

      if (!hasSufficientPayment({ tx, requiredPriceSol: job.priceSol })) {
        await updateJob(job.jobId, {
          errorCode: "insufficient_payment",
          errorMessage: `Detected payment is lower than required ${job.priceSol} SOL.`,
        });
        results.push({ signature, jobId: job.jobId, result: "insufficient_amount" });
        continue;
      }

      const confirmed = await isSignatureConfirmed(signature);
      if (!confirmed) {
        results.push({ signature, jobId: job.jobId, result: "ignored" });
        continue;
      }

      await markPaymentConfirmed(job.jobId, signature);
      await triggerJobProcessing(job.jobId);
      results.push({ signature, jobId: job.jobId, result: "confirmed" });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    return NextResponse.json(
      { ok: false, error: "Failed to process Helius webhook", message },
      { status: 500 },
    );
  }
}
