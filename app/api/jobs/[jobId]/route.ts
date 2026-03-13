import { getJobArtifacts } from "@/lib/jobs/repository";
import { recoverJobIfNeeded } from "@/lib/jobs/recovery";
import { buildPaymentInstructions } from "@/lib/payments/instructions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_: Request, context: Context) {
  const { jobId } = await context.params;
  let recoveryWarning: string | null = null;

  try {
    await recoverJobIfNeeded(jobId);
  } catch (error) {
    recoveryWarning =
      error instanceof Error ? error.message : "Unknown recovery error";
    console.error(`[jobs:${jobId}] recovery failed`, error);
  }

  try {
    const { job, report, video } = await getJobArtifacts(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      job,
      report,
      video,
      status: job.status,
      progress: job.progress,
      payment: buildPaymentInstructions(job),
      warning: recoveryWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch job", message },
      { status: 500 },
    );
  }
}
