import { getVideo } from "@/lib/jobs/repository";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_: Request, context: Context) {
  const { jobId } = await context.params;
  const video = await getVideo(jobId);
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (!video.videoUrl) {
    return NextResponse.json(
      { error: "Video is still rendering", renderStatus: video.renderStatus },
      { status: 409 },
    );
  }

  return NextResponse.redirect(video.videoUrl, 302);
}
