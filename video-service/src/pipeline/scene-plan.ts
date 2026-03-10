import { NormalizedRenderRequest, RenderScene } from "../types";

export interface SceneChunk {
  chunkId: string;
  sceneNumber: number;
  chunkIndex: number;
  chunkCount: number;
  durationSeconds: number;
  visualPrompt: string;
  narration: string;
  imageUrl: string | null;
}

function splitDuration(totalSeconds: number, maxSeconds: number): number[] {
  const safeTotal = Math.max(1, Math.floor(totalSeconds));
  const durations: number[] = [];
  let remaining = safeTotal;
  while (remaining > 0) {
    const next = Math.min(maxSeconds, remaining);
    durations.push(next);
    remaining -= next;
  }
  return durations;
}

function chunkPrompt(basePrompt: string, chunk: SceneChunk): string {
  return [
    basePrompt,
    `Scene ${chunk.sceneNumber}, chunk ${chunk.chunkIndex + 1}/${chunk.chunkCount}.`,
    `Visual direction: ${chunk.visualPrompt}`,
    `Narration timing anchor: ${chunk.narration}`,
    `Target duration: ${chunk.durationSeconds}s`,
    "Maintain continuity with previous chunks and avoid introducing fabricated trade facts.",
  ].join("\n");
}

export function buildSceneChunks(input: {
  request: NormalizedRenderRequest;
  maxClipSeconds: number;
}): Array<SceneChunk & { prompt: string }> {
  const basePrompt =
    input.request.metadata?.prompt ??
    input.request.prompt ??
    input.request.hookLine ??
    "Create a cinematic scene.";

  const chunks: Array<SceneChunk & { prompt: string }> = [];

  for (const scene of input.request.scenes) {
    const durations = splitDuration(scene.durationSeconds, input.maxClipSeconds);
    const chunkCount = durations.length;

    durations.forEach((durationSeconds, chunkIndex) => {
      const chunk: SceneChunk = {
        chunkId: `${scene.sceneNumber}-${chunkIndex + 1}`,
        sceneNumber: scene.sceneNumber,
        chunkIndex,
        chunkCount,
        durationSeconds,
        visualPrompt: scene.visualPrompt,
        narration: scene.narration,
        imageUrl: scene.imageUrl ?? null,
      };

      chunks.push({
        ...chunk,
        prompt: chunkPrompt(basePrompt, chunk),
      });
    });
  }

  return chunks;
}

export function normalizeScenes(scenes: RenderScene[]): RenderScene[] {
  return scenes
    .map((scene, index) => ({
      ...scene,
      sceneNumber: scene.sceneNumber || index + 1,
      durationSeconds: Math.max(1, Math.floor(scene.durationSeconds)),
      imageUrl: scene.imageUrl ?? null,
    }))
    .sort((a, b) => a.sceneNumber - b.sceneNumber);
}
