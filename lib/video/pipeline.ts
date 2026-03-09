import { generateCinematicScript } from "@/lib/ai/cinematic";
import { renderCinematicVideo } from "@/lib/video/client";
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
  const rendered = await renderCinematicVideo({
    jobId: input.jobId,
    wallet: input.walletStory.wallet,
    durationSeconds: input.walletStory.durationSeconds,
    script,
  });

  return {
    script,
    videoUrl: rendered.videoUrl,
    thumbnailUrl: rendered.thumbnailUrl,
  };
}
