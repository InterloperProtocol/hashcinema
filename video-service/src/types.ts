import { z } from "zod";

const sceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  visualPrompt: z.string().min(1),
  narration: z.string().min(1),
  durationSeconds: z.number().int().positive(),
  imageUrl: z.string().url().nullable().optional(),
  includeAudio: z.boolean().optional(),
});

const analyticsSchema = z.object({
  pumpTokensTraded: z.number().optional(),
  buyCount: z.number().optional(),
  sellCount: z.number().optional(),
  solSpent: z.number().optional(),
  solReceived: z.number().optional(),
  estimatedPnlSol: z.number().optional(),
  bestTrade: z.string().optional(),
  worstTrade: z.string().optional(),
  styleClassification: z.string().optional(),
});

const tokenMetadataSchema = z.object({
  mint: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().nullable().optional(),
  imageUrl: z.string().url(),
  tradeCount: z.number().optional(),
  buyCount: z.number().optional(),
  sellCount: z.number().optional(),
  solVolume: z.number().optional(),
  lastSeenTimestamp: z.number().optional(),
});

const sceneMetadataSchema = z.object({
  sceneNumber: z.number().int().positive(),
  durationSeconds: z.number().int().positive(),
  narration: z.string().min(1),
  visualPrompt: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
});

const storyMetadataSchema = z.object({
  wallet: z.string().min(1),
  rangeDays: z.number().int().positive(),
  packageType: z.enum(["1d", "2d", "3d"]),
  durationSeconds: z.number().int().positive(),
  analytics: analyticsSchema.partial().optional(),
});

const googleVeoMetadataSchema = z.object({
  provider: z.literal("google_veo"),
  model: z.string().min(1),
  prompt: z.string().min(1),
  styleHints: z.array(z.string()).default([]),
  tokenMetadata: z.array(tokenMetadataSchema).default([]),
  sceneMetadata: z.array(sceneMetadataSchema).min(1),
  storyMetadata: storyMetadataSchema,
});

export const renderRequestSchema = z.object({
  jobId: z.string().min(1),
  wallet: z.string().min(1),
  durationSeconds: z.number().int().positive(),
  withSound: z.boolean(),
  hookLine: z.string().min(1),
  scenes: z.array(sceneSchema).min(1),
  videoEngine: z.enum(["generic", "google_veo"]),
  provider: z.string().optional(),
  prompt: z.string().optional(),
  metadata: googleVeoMetadataSchema.optional(),
  googleVeo: googleVeoMetadataSchema.optional(),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;
export type RenderScene = z.infer<typeof sceneSchema>;
export type GoogleVeoMetadata = z.infer<typeof googleVeoMetadataSchema>;

export interface NormalizedRenderRequest
  extends Omit<RenderRequest, "metadata" | "googleVeo"> {
  metadata?: GoogleVeoMetadata;
  googleVeo?: GoogleVeoMetadata;
}

export type RenderStatus = "queued" | "processing" | "ready" | "failed";

export interface RenderJobRecord {
  id: string;
  jobId: string;
  status: RenderStatus;
  renderStatus: RenderStatus;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  request: NormalizedRenderRequest;
}

export function parseRenderRequest(payload: unknown): NormalizedRenderRequest {
  const parsed = renderRequestSchema.parse(payload);

  if (parsed.videoEngine === "google_veo") {
    if (parsed.provider !== "google_veo") {
      throw new Error("provider must be 'google_veo' when videoEngine=google_veo");
    }

    if (!parsed.prompt || !parsed.prompt.trim()) {
      throw new Error("prompt is required when videoEngine=google_veo");
    }

    const metadata = parsed.metadata ?? parsed.googleVeo;
    if (!metadata) {
      throw new Error("metadata or googleVeo is required when videoEngine=google_veo");
    }

    if (!metadata.model || !metadata.sceneMetadata?.length || !metadata.storyMetadata) {
      throw new Error(
        "metadata.model, metadata.sceneMetadata, and metadata.storyMetadata are required for Veo renders",
      );
    }

    return {
      ...parsed,
      metadata,
      googleVeo: metadata,
    };
  }

  return {
    ...parsed,
    metadata: parsed.metadata,
    googleVeo: parsed.googleVeo,
  };
}
