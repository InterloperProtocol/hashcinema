import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FastifyInstance } from "fastify";
import { buildVideoService, RenderServicePort } from "../video-service/src/server";
import { parseRenderRequest } from "../video-service/src/types";

class InMemoryRenderService implements RenderServicePort {
  private readonly records = new Map<
    string,
    {
      id: string;
      status: "queued" | "ready";
      renderStatus: "queued" | "ready";
      videoUrl: string | null;
      thumbnailUrl: string | null;
      error: string | null;
    }
  >();

  async startOrGet(request: ReturnType<typeof parseRenderRequest>) {
    const existing = this.records.get(request.jobId);
    if (existing) {
      if (existing.status === "ready" && existing.videoUrl) {
        return {
          mode: "sync" as const,
          id: existing.id,
          jobId: existing.id,
          videoUrl: existing.videoUrl,
          thumbnailUrl: existing.thumbnailUrl,
        };
      }

      return {
        mode: "async" as const,
        id: existing.id,
        jobId: existing.id,
      };
    }

    this.records.set(request.jobId, {
      id: request.jobId,
      status: "queued",
      renderStatus: "queued",
      videoUrl: null,
      thumbnailUrl: null,
      error: null,
    });

    return {
      mode: "async" as const,
      id: request.jobId,
      jobId: request.jobId,
    };
  }

  async getById(id: string) {
    return this.records.get(id) ?? null;
  }

  markReady(id: string) {
    const current = this.records.get(id);
    if (!current) return;
    this.records.set(id, {
      ...current,
      status: "ready",
      renderStatus: "ready",
      videoUrl: "https://cdn.example.com/final.mp4",
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
    });
  }
}

function buildPayload(jobId: string) {
  return {
    jobId,
    wallet: "wallet",
    durationSeconds: 30,
    withSound: true,
    hookLine: "hook line",
    scenes: [
      {
        sceneNumber: 1,
        visualPrompt: "visual prompt",
        narration: "narration prompt",
        durationSeconds: 10,
        imageUrl: "https://cdn.example.com/image.png",
        includeAudio: true,
      },
    ],
    videoEngine: "google_veo",
    provider: "google_veo",
    prompt: "global prompt",
    metadata: {
      provider: "google_veo",
      model: "veo-3",
      prompt: "global prompt",
      styleHints: ["memetic"],
      tokenMetadata: [],
      sceneMetadata: [
        {
          sceneNumber: 1,
          durationSeconds: 10,
          narration: "narration prompt",
          visualPrompt: "visual prompt",
          imageUrl: "https://cdn.example.com/image.png",
        },
      ],
      storyMetadata: {
        wallet: "wallet",
        rangeDays: 1,
        packageType: "1d",
        durationSeconds: 30,
        analytics: {},
      },
    },
  };
}

describe("video-service /render contract", () => {
  let app: FastifyInstance;
  let service: InMemoryRenderService;

  beforeAll(async () => {
    service = new InMemoryRenderService();
    app = buildVideoService({
      service,
      authToken: "video-secret",
      baseUrl: "http://video.test",
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthorized requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/render",
      payload: buildPayload("job-unauthorized"),
    });

    expect(response.statusCode).toBe(401);
  });

  it("validates required Veo fields", async () => {
    const payload = buildPayload("job-invalid");
    // @ts-expect-error test invalid payload shape
    delete payload.metadata;

    const response = await app.inject({
      method: "POST",
      url: "/render",
      headers: {
        authorization: "Bearer video-secret",
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns idempotent async response for duplicate POSTs", async () => {
    const payload = buildPayload("job-idempotent");

    const first = await app.inject({
      method: "POST",
      url: "/render",
      headers: {
        authorization: "Bearer video-secret",
      },
      payload,
    });

    const second = await app.inject({
      method: "POST",
      url: "/render",
      headers: {
        authorization: "Bearer video-secret",
      },
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const firstBody = first.json();
    const secondBody = second.json();
    expect(firstBody.id).toBe("job-idempotent");
    expect(secondBody.id).toBe("job-idempotent");
    expect(secondBody.statusUrl).toBe("http://video.test/render/job-idempotent");
  });

  it("supports async status lifecycle via GET /render/:id and /render/status/:id", async () => {
    await app.inject({
      method: "POST",
      url: "/render",
      headers: {
        authorization: "Bearer video-secret",
      },
      payload: buildPayload("job-status"),
    });

    const queued = await app.inject({
      method: "GET",
      url: "/render/job-status",
      headers: {
        authorization: "Bearer video-secret",
      },
    });
    expect(queued.statusCode).toBe(200);
    expect(queued.json().status).toBe("queued");

    service.markReady("job-status");

    const ready = await app.inject({
      method: "GET",
      url: "/render/status/job-status",
      headers: {
        authorization: "Bearer video-secret",
      },
    });

    expect(ready.statusCode).toBe(200);
    expect(ready.json().renderStatus).toBe("ready");
    expect(ready.json().videoUrl).toContain("final.mp4");
  });
});
