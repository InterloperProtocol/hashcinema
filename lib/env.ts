import { z } from "zod";
import { PublicKey } from "@solana/web3.js";

function isValidSolanaPublicKey(value: string): boolean {
  try {
    // PublicKey constructor validates base58 format and key length.
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

const envSchema = z.object({
  HELIUS_API_KEY: z.string().min(1),
  HELIUS_WEBHOOK_ID: z.string().uuid().optional(),
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_RPC_FALLBACK_URL: z
    .string()
    .url()
    .default("https://api.mainnet-beta.solana.com"),
  OPENROUTER_API_KEY: z.string().min(1),
  VIDEO_API_KEY: z.string().min(1),
  HELIUS_WEBHOOK_SECRET: z.string().min(1).optional(),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  HASHCINEMA_PAYMENT_WALLET: z
    .string()
    .min(32)
    .max(64)
    .refine(isValidSolanaPublicKey, {
      message: "HASHCINEMA_PAYMENT_WALLET must be a valid Solana address",
    }),
  PAYMENT_MASTER_SEED_HEX: z.string().min(64),
  PAYMENT_DERIVATION_PREFIX: z.string().default("hashcinema-job"),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  WORKER_URL: z.string().url().optional(),
  WORKER_TOKEN: z.string().optional(),
  ALLOW_IN_PROCESS_WORKER: z.coerce.boolean().optional(),
  JOB_DISPATCH_BATCH_LIMIT: z.coerce.number().int().positive().default(25),
  VIDEO_RENDER_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .default(5_000),
  VIDEO_RENDER_MAX_POLL_ATTEMPTS: z.coerce
    .number()
    .int()
    .min(1)
    .default(2_160),
  OPENROUTER_BASE_URL: z
    .string()
    .url()
    .default("https://openrouter.ai/api/v1"),
  OPENROUTER_APP_NAME: z.string().default("HASHCINEMA"),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  VIDEO_API_BASE_URL: z.string().url().optional(),
  VIDEO_ENGINE: z.enum(["generic", "google_veo"]).default("generic"),
  VIDEO_VEO_MODEL: z.string().default("veo-3"),
  SWEEP_MIN_LAMPORTS: z.coerce.number().int().nonnegative().default(5_000),
  SWEEP_BATCH_LIMIT: z.coerce.number().int().positive().default(50),
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
    ALLOW_IN_PROCESS_WORKER:
      process.env.ALLOW_IN_PROCESS_WORKER ??
      (process.env.NODE_ENV === "production" ? "false" : "true"),
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
