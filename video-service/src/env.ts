import { z } from "zod";

const serviceEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8090),
  VIDEO_API_KEY: z.string().min(1),
  VIDEO_SERVICE_BASE_URL: z.string().url().optional(),
  VERTEX_PROJECT_ID: z.string().min(1),
  VERTEX_LOCATION: z.string().min(1).default("us-central1"),
  VERTEX_VEO_MODEL: z.string().min(1).default("veo-3"),
  VEO_MAX_CLIP_SECONDS: z.coerce.number().int().min(2).max(30).default(8),
  VERTEX_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(5000),
  VERTEX_MAX_POLL_ATTEMPTS: z.coerce.number().int().min(1).default(180),
  FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
});

export type VideoServiceEnv = z.infer<typeof serviceEnvSchema>;

let cachedEnv: VideoServiceEnv | null = null;

export function getVideoServiceEnv(): VideoServiceEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serviceEnvSchema.safeParse({
    ...process.env,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  });

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid video-service environment configuration: ${missing}`);
  }

  cachedEnv = {
    ...parsed.data,
    FIREBASE_STORAGE_BUCKET:
      parsed.data.FIREBASE_STORAGE_BUCKET ?? `${parsed.data.FIREBASE_PROJECT_ID}.appspot.com`,
  };

  return cachedEnv;
}
