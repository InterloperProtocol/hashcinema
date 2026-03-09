import { getJobArtifacts } from "@/lib/jobs/repository";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_: Request, context: Context) {
  const { jobId } = await context.params;

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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch job", message },
      { status: 500 },
    );
  }
}
