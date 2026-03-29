import { z } from "zod";

const ALLOWED_VEO_MODEL = "veo-3.1-fast-generate-001" as const;
const resolutionSchema = z.enum(["720p", "1080p"]);

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

const sourceMediaProviderSchema = z.enum(["youtube", "spotify"]).nullable().optional();

const tianezhaWorldbuilderSchema = z.object({
  model: z.literal("tianezha"),
  worldName: z.string().min(1),
  sourceKind: z
    .enum([
      "wallet_recap",
      "token_video",
      "generic_cinema",
      "bedtime_story",
      "music_video",
      "scene_recreation",
    ])
    .optional(),
  knowledgeBase: z.array(z.string().min(1)).default([]),
  manifold: z.object({
    anchorPoints: z.array(z.string().min(1)).min(1),
    tangentVectors: z.array(z.string().min(1)).min(1),
    continuityRules: z.array(z.string().min(1)).min(1),
  }),
  storyline: z.array(z.string().min(1)).default([]),
  tests: z.array(
    z.object({
      name: z.string().min(1),
      verdict: z.enum(["pass", "warn", "fail"]),
      detail: z.string().min(1),
    }),
  ).default([]),
  verdict: z.enum(["pass", "warn", "fail"]),
  summary: z.string().min(1),
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

const sceneEmotionVectorSchema = z.object({
  confidence: z.number(),
  chaos: z.number(),
  desperation: z.number(),
  discipline: z.number(),
  luck: z.number(),
  intensity: z.number(),
});

const videoTokenAnchorSchema = z.object({
  mint: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  role: z.enum(["primary", "secondary", "supporting"]),
});

const videoIdentitySheetSchema = z.object({
  identityId: z.string().min(1),
  archetype: z.string().min(1),
  protagonist: z.string().min(1),
  paletteCanon: z.array(z.string().min(1)).min(1),
  worldCanon: z.array(z.string().min(1)).min(1),
  lightingCanon: z.array(z.string().min(1)).min(1),
  symbolCanon: z.array(z.string().min(1)).min(1),
  tokenAnchors: z.array(videoTokenAnchorSchema).default([]),
  negativeConstraints: z.array(z.string().min(1)).min(1),
});

const sceneStateSchema = z.object({
  sceneNumber: z.number().int().positive(),
  phase: z.enum(["opening", "rise", "damage", "pivot", "climax", "aftermath"]),
  stateRef: z.string().min(1),
  emotionVector: sceneEmotionVectorSchema,
  subjectFocus: z.string().min(1),
  continuityAnchors: z.array(z.string().min(1)).min(1),
  deltaFromPrevious: z.array(z.string().min(1)).min(1),
  transitionNote: z.string().min(1),
});

const sceneMetadataSchema = z.object({
  sceneNumber: z.number().int().positive(),
  durationSeconds: z.number().int().positive(),
  narration: z.string().min(1),
  visualPrompt: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  stateRef: z.string().min(1).optional(),
  continuityAnchors: z.array(z.string().min(1)).min(1).optional(),
  continuityPrompt: z.string().min(1).optional(),
});

const storyMetadataSchema = z.object({
  storyKind: z
    .enum([
      "wallet_recap",
      "token_video",
      "generic_cinema",
      "bedtime_story",
      "music_video",
      "scene_recreation",
    ])
    .optional(),
  wallet: z.string().min(1),
  subjectAddress: z.string().min(1).optional(),
  subjectChain: z.enum(["solana", "ethereum", "bsc", "base"]).nullable().optional(),
  subjectName: z.string().min(1).nullable().optional(),
  subjectSymbol: z.string().min(1).nullable().optional(),
  sourceMediaUrl: z.string().url().nullable().optional(),
  sourceEmbedUrl: z.string().url().nullable().optional(),
  sourceMediaProvider: sourceMediaProviderSchema,
  sourceTranscript: z.string().min(1).nullable().optional(),
  experience: z
    .enum([
      "legacy",
      "hashcinema",
      "trenchcinema",
      "funcinema",
      "familycinema",
      "musicvideo",
      "recreator",
    ])
    .nullable()
    .optional(),
  visibility: z.enum(["public", "private"]).nullable().optional(),
  audioEnabled: z.boolean().nullable().optional(),
  rangeDays: z.number().int().positive(),
  packageType: z.enum(["1d", "2d", "3d"]),
  durationSeconds: z.number().int().positive(),
  analytics: analyticsSchema.partial().optional(),
  worldbuilder: tianezhaWorldbuilderSchema.nullable().optional(),
});

const googleVeoMetadataSchema = z.object({
  provider: z.literal("google_veo"),
  model: z.literal(ALLOWED_VEO_MODEL),
  resolution: resolutionSchema,
  generateAudio: z.boolean().default(true),
  prompt: z.string().min(1),
  styleHints: z.array(z.string()).default([]),
  tokenMetadata: z.array(tokenMetadataSchema).default([]),
  sceneMetadata: z.array(sceneMetadataSchema).min(1),
  storyMetadata: storyMetadataSchema,
  coherence: z
    .object({
      identity: videoIdentitySheetSchema,
      sceneStates: z.array(sceneStateSchema).default([]),
      renderPolicy: z
        .object({
          factorization: z.string().min(1),
          continuityMode: z.string().min(1).optional(),
          lintMode: z.string().min(1).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const renderRequestSchema = z.object({
  jobId: z.string().min(1),
  wallet: z.string().min(1),
  durationSeconds: z.number().int().positive(),
  withSound: z.boolean(),
  resolution: resolutionSchema.optional(),
  hookLine: z.string().min(1),
  scenes: z.array(sceneSchema).min(1),
  videoEngine: z.literal("google_veo"),
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

  if (parsed.withSound !== Boolean(metadata.generateAudio)) {
    throw new Error("withSound must match metadata.generateAudio for Veo renders.");
  }

  if (!metadata.model || !metadata.sceneMetadata?.length || !metadata.storyMetadata) {
    throw new Error(
      "metadata.model, metadata.sceneMetadata, and metadata.storyMetadata are required for Veo renders",
    );
  }

  if (metadata.model !== ALLOWED_VEO_MODEL) {
    throw new Error(`Only ${ALLOWED_VEO_MODEL} is allowed for Veo renders.`);
  }

  const requestedResolution = parsed.resolution ?? metadata.resolution;
  if (!requestedResolution) {
    throw new Error("resolution is required and must be 720p or 1080p.");
  }
  if (parsed.resolution && metadata.resolution && parsed.resolution !== metadata.resolution) {
    throw new Error("resolution mismatch between request.resolution and metadata.resolution.");
  }

  return {
    ...parsed,
    withSound: Boolean(metadata.generateAudio),
    resolution: requestedResolution,
    scenes: parsed.scenes.map((scene) => ({
      ...scene,
      includeAudio: Boolean(metadata.generateAudio),
    })),
    metadata: {
      ...metadata,
      model: ALLOWED_VEO_MODEL,
      resolution: requestedResolution,
      generateAudio: Boolean(metadata.generateAudio),
    },
    googleVeo: {
      ...metadata,
      model: ALLOWED_VEO_MODEL,
      resolution: requestedResolution,
      generateAudio: Boolean(metadata.generateAudio),
    },
  };
}
