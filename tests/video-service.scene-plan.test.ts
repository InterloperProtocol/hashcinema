import { buildSceneChunks } from "../video-service/src/pipeline/scene-plan";
import { buildConcatManifest } from "../video-service/src/pipeline/media";
import { NormalizedRenderRequest } from "../video-service/src/types";

function buildRequest(): NormalizedRenderRequest {
  return {
    jobId: "job-1",
    wallet: "wallet",
    durationSeconds: 60,
    withSound: true,
    hookLine: "hook line",
    videoEngine: "google_veo",
    provider: "google_veo",
    prompt: "Global prompt",
    metadata: {
      provider: "google_veo",
      model: "veo-3",
      prompt: "Global prompt",
      styleHints: ["memetic"],
      tokenMetadata: [],
      sceneMetadata: [
        {
          sceneNumber: 1,
          durationSeconds: 17,
          narration: "narration",
          visualPrompt: "visual",
          imageUrl: null,
        },
      ],
      storyMetadata: {
        wallet: "wallet",
        rangeDays: 1,
        packageType: "1d",
        durationSeconds: 60,
        analytics: {},
      },
    },
    googleVeo: undefined,
    scenes: [
      {
        sceneNumber: 1,
        visualPrompt: "visual",
        narration: "narration",
        durationSeconds: 17,
        imageUrl: "https://cdn.example.com/image.png",
        includeAudio: true,
      },
    ],
  };
}

describe("video-service scene chunk planner", () => {
  it("splits long scenes into max-size chunks", () => {
    const chunks = buildSceneChunks({
      request: buildRequest(),
      maxClipSeconds: 8,
    });

    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.durationSeconds).toBe(8);
    expect(chunks[1]?.durationSeconds).toBe(8);
    expect(chunks[2]?.durationSeconds).toBe(1);
    expect(chunks[0]?.prompt.includes("Scene 1, chunk 1/3")).toBe(true);
  });

  it("builds deterministic ffmpeg concat manifest", () => {
    const manifest = buildConcatManifest(["C:/tmp/clip-1.mp4", "C:/tmp/clip-2.mp4"]);
    expect(manifest).toContain("file 'C:/tmp/clip-1.mp4'");
    expect(manifest).toContain("file 'C:/tmp/clip-2.mp4'");
  });
});
