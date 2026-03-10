import { generateCinematicScript } from "@/lib/ai/cinematic";
import { getEnv } from "@/lib/env";
import { renderCinematicVideo } from "@/lib/video/client";
import { buildGoogleVeoRenderPayload } from "@/lib/video/veo";
import { GeneratedCinematicScript, WalletStory } from "@/lib/types/domain";

export async function buildAndRenderVideo(input: {
  jobId: string;
  walletStory: WalletStory;
}): Promise<{
  script: GeneratedCinematicScript;
  videoUrl: string;
  thumbnailUrl: string | null;
}> {
  const script = await generateCinematicScript(input.walletStory);
  const env = getEnv();
  const googleVeoPayload = buildGoogleVeoRenderPayload({
    walletStory: input.walletStory,
    script,
    model: env.VIDEO_VEO_MODEL,
  });

  const rendered = await renderCinematicVideo({
    jobId: input.jobId,
    wallet: input.walletStory.wallet,
    durationSeconds: input.walletStory.durationSeconds,
    script,
    googleVeo: googleVeoPayload,
  });

  return {
    script,
    videoUrl: rendered.videoUrl,
    thumbnailUrl: rendered.thumbnailUrl,
  };
}
