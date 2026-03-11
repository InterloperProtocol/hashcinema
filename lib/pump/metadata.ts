import { getHeliusClient } from "@/lib/helius/client";
import { getPumpMetadata, upsertPumpMetadata } from "@/lib/jobs/repository";
import { logger } from "@/lib/logging/logger";
import { fetchWithTimeout } from "@/lib/network/http";
import {
  isRetryableHttpStatus,
  RetryableError,
  withRetry,
} from "@/lib/network/retry";
import { PumpMetadataCacheDocument } from "@/lib/types/domain";

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const PUMP_FUN_API_BASE_URL = "https://frontend-api-v3.pump.fun";
const DEXSCREENER_API_BASE_URL = "https://api.dexscreener.com";
const METADATA_HTTP_TIMEOUT_MS = 6_000;
const METADATA_HTTP_RETRY_ATTEMPTS = 2;
const HELIUS_ASSET_TIMEOUT_MS = 6_000;
const HELIUS_ASSET_RETRY_ATTEMPTS = 2;

interface PumpFunCoinResponse {
  mint?: string;
  name?: string;
  symbol?: string;
  description?: string;
  image_uri?: string;
  imageUri?: string;
  image?: string;
  metadata_uri?: string;
  metadataUri?: string;
  uri?: string;
}

interface DexScreenerTokenPairResponse {
  dexId?: string;
  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
  volume?: {
    h24?: number;
  };
}

interface DexScreenerTokenMetadata {
  name: string | null;
  symbol: string | null;
  isPump: boolean;
}

interface HeliusAssetMetadata {
  name: string | null;
  symbol: string | null;
  image: string | null;
  description: string | null;
  jsonUri: string | null;
}

export interface PumpTokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  description: string | null;
  isPump: boolean;
}

function isFresh(cachedAt: string): boolean {
  const age = Date.now() - new Date(cachedAt).getTime();
  return age >= 0 && age < CACHE_MAX_AGE_MS;
}

function inferPumpSignal(input: {
  name: string;
  symbol: string;
  description: string | null;
  image: string | null;
  jsonUri?: string;
}): boolean {
  const haystack = [
    input.name,
    input.symbol,
    input.description ?? "",
    input.image ?? "",
    input.jsonUri ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes("pump.fun") || haystack.includes(" pump ");
}

function sanitizeString(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const value = input.trim();
  return value.length ? value : null;
}

function normalizeMaybeUrl(input: unknown): string | null {
  const value = sanitizeString(input);
  if (!value) return null;

  if (value.toLowerCase().startsWith("ipfs://")) {
    const ipfsPath = value.replace(/^ipfs:\/\//i, "").replace(/^ipfs\//i, "");
    const normalizedPath = ipfsPath.replace(/^\/+/, "");
    if (!normalizedPath) {
      return null;
    }
    return `https://ipfs.io/ipfs/${normalizedPath}`;
  }

  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return null;
  }
}

async function withPromiseTimeout<T>(input: {
  operation: () => Promise<T>;
  timeoutMs: number;
  timeoutMessage: string;
}): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new RetryableError(input.timeoutMessage));
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([input.operation(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function fetchPumpFunMetadata(mint: string): Promise<PumpFunCoinResponse | null> {
  const url = `${PUMP_FUN_API_BASE_URL}/coins/${encodeURIComponent(mint)}`;

  return withRetry(
    async () => {
      const response = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
        METADATA_HTTP_TIMEOUT_MS,
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const message = `Pump.fun metadata request failed (${response.status}) for mint ${mint}`;
        if (isRetryableHttpStatus(response.status)) {
          throw new RetryableError(message);
        }
        return null;
      }

      try {
        return (await response.json()) as PumpFunCoinResponse;
      } catch {
        return null;
      }
    },
    {
      attempts: METADATA_HTTP_RETRY_ATTEMPTS,
      baseDelayMs: 350,
      maxDelayMs: 2_500,
      shouldRetry: (error) =>
        error instanceof RetryableError ||
        (error instanceof TypeError && error.message.length > 0),
    },
  );
}

function toFiniteNumber(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string") {
    const parsed = Number.parseFloat(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function selectBestDexScreenerPair(
  mint: string,
  pairs: DexScreenerTokenPairResponse[],
): DexScreenerTokenPairResponse | null {
  const mintLc = mint.toLowerCase();
  const matching = pairs.filter(
    (pair) => pair.baseToken?.address?.toLowerCase() === mintLc,
  );

  if (!matching.length) {
    return null;
  }

  matching.sort(
    (a, b) => toFiniteNumber(b.volume?.h24) - toFiniteNumber(a.volume?.h24),
  );

  return matching[0] ?? null;
}

async function fetchDexScreenerMetadata(
  mint: string,
): Promise<DexScreenerTokenMetadata | null> {
  const url = `${DEXSCREENER_API_BASE_URL}/tokens/v1/solana/${encodeURIComponent(mint)}`;

  return withRetry(
    async () => {
      const response = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
        METADATA_HTTP_TIMEOUT_MS,
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const message = `DexScreener metadata request failed (${response.status}) for mint ${mint}`;
        if (isRetryableHttpStatus(response.status)) {
          throw new RetryableError(message);
        }
        return null;
      }

      try {
        const raw = (await response.json()) as unknown;
        if (!Array.isArray(raw)) {
          return null;
        }

        const pair = selectBestDexScreenerPair(
          mint,
          raw as DexScreenerTokenPairResponse[],
        );
        if (!pair) {
          return null;
        }

        return {
          name: sanitizeString(pair.baseToken?.name),
          symbol: sanitizeString(pair.baseToken?.symbol),
          isPump: sanitizeString(pair.dexId)?.toLowerCase() === "pumpfun",
        };
      } catch {
        return null;
      }
    },
    {
      attempts: METADATA_HTTP_RETRY_ATTEMPTS,
      baseDelayMs: 350,
      maxDelayMs: 2_500,
      shouldRetry: (error) =>
        error instanceof RetryableError ||
        (error instanceof TypeError && error.message.length > 0),
    },
  );
}

async function fetchHeliusAssetMetadata(
  mint: string,
): Promise<HeliusAssetMetadata | null> {
  const helius = getHeliusClient();

  return withRetry(
    async () => {
      const asset = await withPromiseTimeout({
        operation: () => helius.getAsset({ id: mint }),
        timeoutMs: HELIUS_ASSET_TIMEOUT_MS,
        timeoutMessage: `Helius asset metadata timeout after ${HELIUS_ASSET_TIMEOUT_MS}ms for mint ${mint}`,
      });

      return {
        name: sanitizeString(asset.content?.metadata?.name),
        symbol: sanitizeString(asset.content?.metadata?.symbol),
        image: normalizeMaybeUrl(asset.content?.links?.image),
        description: sanitizeString(asset.content?.metadata?.description),
        jsonUri: normalizeMaybeUrl(asset.content?.json_uri),
      };
    },
    {
      attempts: HELIUS_ASSET_RETRY_ATTEMPTS,
      baseDelayMs: 400,
      maxDelayMs: 2_500,
      shouldRetry: (error) =>
        error instanceof RetryableError ||
        (error instanceof TypeError && error.message.length > 0),
    },
  );
}

export async function getOrFetchPumpMetadata(
  mint: string,
): Promise<PumpTokenMetadata> {
  const cached = await getPumpMetadata(mint);
  if (cached && isFresh(cached.cachedAt)) {
    return {
      mint: cached.mint,
      name: cached.name,
      symbol: cached.symbol,
      image: cached.image,
      description: cached.description,
      isPump: inferPumpSignal({
        name: cached.name,
        symbol: cached.symbol,
        description: cached.description,
        image: cached.image,
      }),
    };
  }

  const [pumpfunResult, dexscreenerResult] = await Promise.allSettled([
    fetchPumpFunMetadata(mint),
    fetchDexScreenerMetadata(mint),
  ]);

  let pumpfun: PumpFunCoinResponse | null = null;
  if (pumpfunResult.status === "fulfilled") {
    pumpfun = pumpfunResult.value;
  } else {
    logger.warn("pumpfun_metadata_fetch_failed", {
      component: "pump_metadata",
      stage: "fetch_pumpfun_metadata",
      mint,
      errorCode: "pumpfun_metadata_fetch_failed",
      errorMessage:
        pumpfunResult.reason instanceof Error
          ? pumpfunResult.reason.message
          : "Unknown error",
    });
  }

  let dexscreener: DexScreenerTokenMetadata | null = null;
  if (dexscreenerResult.status === "fulfilled") {
    dexscreener = dexscreenerResult.value;
  } else {
    logger.warn("dexscreener_metadata_fetch_failed", {
      component: "pump_metadata",
      stage: "fetch_dexscreener_metadata",
      mint,
      errorCode: "dexscreener_metadata_fetch_failed",
      errorMessage:
        dexscreenerResult.reason instanceof Error
          ? dexscreenerResult.reason.message
          : "Unknown error",
    });
  }

  const pumpfunName = sanitizeString(pumpfun?.name);
  const pumpfunSymbol = sanitizeString(pumpfun?.symbol);
  const pumpfunImage = normalizeMaybeUrl(
    pumpfun?.image_uri ?? pumpfun?.imageUri ?? pumpfun?.image,
  );
  const pumpfunDescription = sanitizeString(pumpfun?.description);
  const pumpfunJsonUri = normalizeMaybeUrl(
    pumpfun?.metadata_uri ?? pumpfun?.metadataUri ?? pumpfun?.uri,
  );

  const needsHeliusFallback =
    (!pumpfunName && !dexscreener?.name) ||
    (!pumpfunSymbol && !dexscreener?.symbol) ||
    !pumpfunImage ||
    !pumpfunDescription;

  let helius: HeliusAssetMetadata | null = null;

  if (!pumpfun || needsHeliusFallback) {
    try {
      helius = await fetchHeliusAssetMetadata(mint);
    } catch (error) {
      logger.warn("helius_asset_metadata_fetch_failed", {
        component: "pump_metadata",
        stage: "fetch_helius_asset_metadata",
        mint,
        errorCode: "helius_asset_metadata_fetch_failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const name = pumpfunName ?? dexscreener?.name ?? helius?.name ?? mint.slice(0, 6);
  const symbol = pumpfunSymbol ?? dexscreener?.symbol ?? helius?.symbol ?? "UNKNOWN";
  const image = pumpfunImage ?? helius?.image ?? null;
  const description = pumpfunDescription ?? helius?.description ?? null;
  const jsonUri = pumpfunJsonUri ?? helius?.jsonUri ?? undefined;

  const doc: PumpMetadataCacheDocument = {
    mint,
    name,
    symbol,
    image,
    description,
    cachedAt: new Date().toISOString(),
  };
  try {
    await upsertPumpMetadata(doc);
  } catch (error) {
    logger.warn("pump_metadata_cache_write_failed", {
      component: "pump_metadata",
      stage: "cache_write",
      mint,
      errorCode: "pump_metadata_cache_write_failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return {
    mint,
    name,
    symbol,
    image,
    description,
    isPump:
      Boolean(pumpfun) ||
      Boolean(dexscreener?.isPump) ||
      inferPumpSignal({ name, symbol, image, description, jsonUri }),
  };
}
