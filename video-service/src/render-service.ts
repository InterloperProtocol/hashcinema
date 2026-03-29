import { promises as fs } from "fs";
import path from "path";
import {
  claimRenderJob,
  createOrGetRenderJob,
  getRenderJob,
  listRecoverableRenderJobs,
  markRenderFailed,
  markRenderReady,
  touchRenderJob,
  updateRenderJob,
} from "./repository";
import { getVideoServiceEnv } from "./env";
import { NormalizedRenderRequest, RenderJobRecord } from "./types";
import { buildSceneChunks, normalizeScenes } from "./pipeline/scene-plan";
import {
  concatClips,
  generateThumbnail,
  downloadSourceMediaArtifacts,
  stageClipFiles,
  muxVideoWithAudio,
  uploadLocalFile,
} from "./pipeline/media";
import { GenerateClipInput, VertexVeoClient } from "./providers/vertex-veo";

export interface RenderServiceResultSync {
  mode: "sync";
  id: string;
  jobId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
}

export interface RenderServiceResultAsync {
  mode: "async";
  id: string;
  jobId: string;
}

export type RenderServiceStartResult = RenderServiceResultSync | RenderServiceResultAsync;

export interface ClipGenerator {
  generateClip(input: GenerateClipInput): Promise<{
    operationName: string;
    videoUris: string[];
    videoBytesBase64: string[];
  }>;
}

const ALLOWED_VEO_MODEL = "veo-3.1-fast-generate-001" as const;

function normalizeVeoModel(
  value: unknown,
  fallback: typeof ALLOWED_VEO_MODEL,
): typeof ALLOWED_VEO_MODEL {
  return value === ALLOWED_VEO_MODEL ? ALLOWED_VEO_MODEL : fallback;
}

function normalizeResolution(
  value: unknown,
  fallback: "720p" | "1080p",
): "720p" | "1080p" {
  if (value === "720p" || value === "1080p") {
    return value;
  }
  return fallback;
}

function detectSourceMediaProvider(value?: string | null): "youtube" | "spotify" | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (
      host === "youtu.be" ||
      host.endsWith("youtube.com") ||
      host.endsWith("youtube-nocookie.com")
    ) {
      return "youtube";
    }

    if (host.endsWith("spotify.com")) {
      return "spotify";
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveRenderConfig(input: {
  metadata?: { model?: unknown; resolution?: unknown } | null;
  requestResolution?: unknown;
  envModel: typeof ALLOWED_VEO_MODEL;
  envResolution: "720p" | "1080p";
}): { model: typeof ALLOWED_VEO_MODEL; resolution: "720p" | "1080p" } {
  return {
    model: normalizeVeoModel(input.metadata?.model, input.envModel),
    resolution: normalizeResolution(
      input.metadata?.resolution ?? input.requestResolution,
      input.envResolution,
    ),
  };
}

export class RenderService {
  private readonly activeRenders = new Set<string>();

  constructor(private readonly clipGenerator: ClipGenerator = new VertexVeoClient()) {}

  async startOrGet(request: NormalizedRenderRequest): Promise<RenderServiceStartResult> {
    const normalizedRequest: NormalizedRenderRequest = {
      ...request,
      scenes: normalizeScenes(request.scenes),
    };

    const existing = await getRenderJob(normalizedRequest.jobId);
    if (existing) {
      if (existing.status === "ready" && existing.videoUrl) {
        return {
          mode: "sync",
          id: existing.id,
          jobId: existing.jobId,
          videoUrl: existing.videoUrl,
          thumbnailUrl: existing.thumbnailUrl,
        };
      }

      if (existing.status === "failed") {
        // Failed renders must be re-queued on retries instead of staying permanently terminal.
        await updateRenderJob(existing.id, {
          status: "queued",
          renderStatus: "queued",
          videoUrl: null,
          thumbnailUrl: null,
          error: null,
          startedAt: null,
          completedAt: null,
          request: normalizedRequest,
        });
      }

      this.kickRender(existing.id);
      return {
        mode: "async",
        id: existing.id,
        jobId: existing.jobId,
      };
    }

    const created = await createOrGetRenderJob(normalizedRequest.jobId, normalizedRequest);
    this.kickRender(created.record.id);

    if (created.record.status === "ready" && created.record.videoUrl) {
      return {
        mode: "sync",
        id: created.record.id,
        jobId: created.record.jobId,
        videoUrl: created.record.videoUrl,
        thumbnailUrl: created.record.thumbnailUrl,
      };
    }

    return {
      mode: "async",
      id: created.record.id,
      jobId: created.record.jobId,
    };
  }

  async getById(id: string): Promise<RenderJobRecord | null> {
    return getRenderJob(id);
  }

  async resumePendingJobs(limit?: number): Promise<number> {
    const env = getVideoServiceEnv();
    const jobs = await listRecoverableRenderJobs({
      limit: limit ?? env.RENDER_RECOVERY_BATCH_LIMIT,
      staleAfterMs: env.RENDER_STALE_MS,
    });

    for (const job of jobs) {
      this.kickRender(job.id);
    }

    return jobs.length;
  }

  private kickRender(jobId: string): void {
    if (this.activeRenders.has(jobId)) {
      return;
    }

    this.activeRenders.add(jobId);
    void this.runRender(jobId).finally(() => {
      this.activeRenders.delete(jobId);
    });
  }

  private async runRender(jobId: string): Promise<void> {
    const env = getVideoServiceEnv();
    const claimed = await claimRenderJob(jobId, env.RENDER_STALE_MS);
    if (!claimed) {
      return;
    }

    try {
      await this.processRender(claimed);
    } catch (error) {
      await markRenderFailed(
        claimed.id,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  private async processRender(record: RenderJobRecord): Promise<void> {
    const env = getVideoServiceEnv();

    const metadata = record.request.metadata ?? record.request.googleVeo;
    const sourceMediaProvider =
      metadata?.storyMetadata?.sourceMediaProvider === "youtube" ||
      metadata?.storyMetadata?.sourceMediaProvider === "spotify"
        ? metadata.storyMetadata.sourceMediaProvider
        : detectSourceMediaProvider(metadata?.storyMetadata?.sourceMediaUrl ?? null);
    const sourceAudioMode =
      sourceMediaProvider === "youtube" || sourceMediaProvider === "spotify"
        ? "source_track"
        : "generated";
    const { model, resolution } = resolveRenderConfig({
      metadata,
      requestResolution: record.request.resolution,
      envModel: env.VERTEX_VEO_MODEL,
      envResolution: env.VEO_OUTPUT_RESOLUTION,
    });
    const styleHints = metadata?.styleHints ?? [];
    const generateAudio =
      sourceAudioMode === "source_track" ? false : metadata?.generateAudio ?? record.request.withSound;
    const chunks = buildSceneChunks({
      request: record.request,
      maxClipSeconds: env.VEO_MAX_CLIP_SECONDS,
    });

    if (!chunks.length) {
      throw new Error("No scene chunks available for rendering.");
    }

    const clipUris: string[] = [];
    for (const chunk of chunks) {
      const clip = await this.clipGenerator.generateClip({
        model,
        resolution,
        prompt: chunk.prompt,
        durationSeconds: chunk.durationSeconds,
        imageUrl: chunk.imageUrl,
        styleHints,
        generateAudio,
        storageUri: `gs://${env.FIREBASE_STORAGE_BUCKET}/video-renders/${record.jobId}/clips/${chunk.chunkId}`,
        onProgress: () => touchRenderJob(record.id),
      });
      const uri = clip.videoUris[0];
      const inlineVideo = clip.videoBytesBase64[0];
      if (uri) {
        clipUris.push(uri);
      } else if (inlineVideo) {
        clipUris.push(`data:video/mp4;base64,${inlineVideo}`);
      } else {
        throw new Error(`Clip render for job ${record.jobId} completed without a video asset.`);
      }
      await touchRenderJob(record.id);
    }

    const { directory, clipPaths } = await stageClipFiles({ clipUris });
    const outputVideoPath = path.join(directory, "final.mp4");
    const outputThumbPath = path.join(directory, "thumbnail.jpg");
    let sourceThumbnailPath: string | null = null;
    let finalVideoPath = outputVideoPath;

    try {
      await concatClips({
        clipPaths,
        outputPath: outputVideoPath,
        workingDir: directory,
      });

      if (sourceAudioMode === "source_track") {
        const sourceArtifacts = await downloadSourceMediaArtifacts({
          sourceUrls: [
            metadata?.storyMetadata?.sourceMediaUrl ?? null,
            metadata?.storyMetadata?.sourceEmbedUrl ?? null,
          ].filter((value): value is string => Boolean(value)),
          workingDir: directory,
        });
        sourceThumbnailPath = sourceArtifacts.thumbnailPath;
        finalVideoPath = path.join(directory, "final-source-audio.mp4");
        await muxVideoWithAudio({
          videoPath: outputVideoPath,
          audioPath: sourceArtifacts.audioPath,
          outputPath: finalVideoPath,
          workingDir: directory,
        });
      }

      try {
        await generateThumbnail({
          videoPath: finalVideoPath,
          outputPath: outputThumbPath,
          workingDir: directory,
        });
      } catch (error) {
        if (!sourceThumbnailPath) {
          throw error;
        }
        await fs.copyFile(sourceThumbnailPath, outputThumbPath);
      }

      const [videoUrl, thumbnailUrl] = await Promise.all([
        uploadLocalFile({
          localPath: finalVideoPath,
          storagePath: `video-renders/${record.jobId}/final.mp4`,
          contentType: "video/mp4",
        }),
        uploadLocalFile({
          localPath: outputThumbPath,
          storagePath: `video-renders/${record.jobId}/thumbnail.jpg`,
          contentType: "image/jpeg",
        }),
      ]);

      await markRenderReady(record.id, {
        videoUrl,
        thumbnailUrl,
      });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}
