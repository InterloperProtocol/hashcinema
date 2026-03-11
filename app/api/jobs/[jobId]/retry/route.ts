import { triggerFailedJobRetry } from "@/lib/jobs/trigger-retry";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request-ip";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  const { jobId } = await context.params;
  if (!jobId || jobId.trim().length < 8) {
    return NextResponse.json({ ok: false, error: "Invalid jobId" }, { status: 400 });
  }

  const normalizedJobId = jobId.trim();

  try {
    const ip = getRequestIp(request);
    const rateLimit = await enforceRateLimit({
      scope: "api_jobs_retry_post",
      key: `${ip}:${normalizedJobId}`,
      rules: [
        { name: "retry_job_per_minute", windowSec: 60, limit: 3 },
        { name: "retry_job_per_hour", windowSec: 60 * 60, limit: 10 },
      ],
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

    const result = await triggerFailedJobRetry(normalizedJobId);
    if (result.status === "skipped") {
      return NextResponse.json(
        { ok: false, error: "Retry skipped", ...result },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown retry error";
    return NextResponse.json(
      { ok: false, error: "Failed to retry job", message },
      { status: 500 },
    );
  }
}

