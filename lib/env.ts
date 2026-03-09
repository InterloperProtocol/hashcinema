import { z } from "zod";

const envSchema = z.object({
  HELIUS_API_KEY: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_RPC_FALLBACK_URL: z
    .string()
    .url()
    .default("https://api.mainnet-beta.solana.com"),
  OPENROUTER_API_KEY: z.string().min(1),
  VIDEO_API_KEY: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  HASHCINEMA_PAYMENT_WALLET: z.string().min(32).max(64),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  WORKER_URL: z.string().url().optional(),
  WORKER_TOKEN: z.string().optional(),
  OPENROUTER_BASE_URL: z
    .string()
    .url()
    .default("https://openrouter.ai/api/v1"),
  OPENROUTER_APP_NAME: z.string().default("HASHCINEMA"),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  VIDEO_API_BASE_URL: z.string().url().optional(),
  ANALYTICS_ENGINE_MODE: z
    .enum(["v2_fallback_legacy", "v2", "legacy"])
    .default("v2_fallback_legacy"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse({
    ...process.env,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n",
    ),
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid environment configuration: ${missing}`);
  }

  const env = parsed.data;
  cachedEnv = {
    ...env,
    FIREBASE_STORAGE_BUCKET:
      env.FIREBASE_STORAGE_BUCKET ?? `${env.FIREBASE_PROJECT_ID}.appspot.com`,
  };

  return cachedEnv;
}
