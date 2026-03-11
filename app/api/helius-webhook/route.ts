import { getEnv } from "@/lib/env";
import { dispatchSingleJob } from "@/lib/jobs/dispatch";
import {
  applyConfirmedPayment,
  getJobByPaymentAddress,
} from "@/lib/jobs/repository";
import {
  HeliusEnhancedWebhookTransaction,
} from "@/lib/payments/webhook";
import { verifyOnChainPayment } from "@/lib/payments/onchain-verify";
import { triggerInstantSweepForJob } from "@/lib/payments/trigger-sweep";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request-ip";
import { isAuthorizedWebhookRequest } from "@/lib/security/webhook-auth";
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

export async function POST(request: NextRequest) {
  try {
    const env = getEnv();
    if (!env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json(
        { ok: false, error: "HELIUS_WEBHOOK_SECRET is not configured" },
        { status: 500 },
      );
    }

    const authorized = isAuthorizedWebhookRequest({
      headers: {
        authorization: request.headers.get("authorization"),
        xHeliusWebhookSecret: request.headers.get("x-helius-webhook-secret"),
        xApiKey: request.headers.get("x-api-key"),
      },
      secret: env.HELIUS_WEBHOOK_SECRET,
    });

    if (!authorized) {
      return NextResponse.json({ ok: false, error: "Unauthorized webhook request" }, { status: 401 });
    }

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
      destination?: string;
      result:
        | "ignored"
        | "job_not_found"
        | "partial_payment"
        | "duplicate"
        | "confirmed";
      lamports?: number;
      remainingLamports?: number;
      dispatch?: "ok" | "retry_scheduled" | "skipped";
      dispatchError?: string;
    }> = [];

    for (const tx of transactions) {
      const signature = tx.signature ?? null;
      if (!signature || tx.transactionError) {
        results.push({ signature, jobId: null, result: "ignored" });
        continue;
      }

      const onChain = await verifyOnChainPayment(signature);
      if (!onChain.confirmed) {
        results.push({ signature, jobId: null, result: "ignored" });
        continue;
      }

      if (onChain.transfers.length === 0) {
        results.push({ signature, jobId: null, result: "ignored" });
        continue;
      }

      for (const transfer of onChain.transfers) {
        if (transfer.lamports <= 0) {
          continue;
        }

        const job = await getJobByPaymentAddress(transfer.destination);
        if (!job) {
          results.push({
            signature,
            jobId: null,
            destination: transfer.destination,
            result: "job_not_found",
            lamports: transfer.lamports,
          });
          continue;
        }

        if (job.status === "complete" || job.status === "failed" || job.status === "processing") {
          results.push({
            signature,
            jobId: job.jobId,
            destination: transfer.destination,
            result: "duplicate",
            lamports: transfer.lamports,
          });
          continue;
        }

        const payment = await applyConfirmedPayment({
          jobId: job.jobId,
          signature,
          lamports: transfer.lamports,
        });

        if (!payment.job) {
          results.push({
            signature,
            jobId: job.jobId,
            destination: transfer.destination,
            result: "job_not_found",
            lamports: transfer.lamports,
          });
          continue;
        }

        if (payment.duplicate) {
          results.push({
            signature,
            jobId: job.jobId,
            destination: transfer.destination,
            result: "duplicate",
            lamports: transfer.lamports,
          });
          continue;
        }

        void triggerInstantSweepForJob(job.jobId).catch(() => {
          // The helper already logs failures; this catch avoids unhandled rejections.
        });

        const remainingLamports = Math.max(
          payment.job.requiredLamports - payment.job.receivedLamports,
          0,
        );

        if (payment.job.status === "payment_confirmed") {
          let dispatch: "ok" | "retry_scheduled" | "skipped" | undefined;
          let dispatchError: string | undefined;
          if (payment.newlyConfirmed) {
            const dispatchResult = await dispatchSingleJob(job.jobId);
            if (dispatchResult.status === "dispatched") {
              dispatch = "ok";
            } else if (dispatchResult.status === "retry_scheduled") {
              dispatch = "retry_scheduled";
              dispatchError = dispatchResult.error;
            } else {
              dispatch = "skipped";
            }
          }

          results.push({
            signature,
            jobId: job.jobId,
            destination: transfer.destination,
            result: "confirmed",
            lamports: transfer.lamports,
            remainingLamports,
            dispatch,
            dispatchError,
          });
          continue;
        }

        results.push({
          signature,
          jobId: job.jobId,
          destination: transfer.destination,
          result: "partial_payment",
          lamports: transfer.lamports,
          remainingLamports,
        });
      }
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
