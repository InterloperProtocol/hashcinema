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
        8_000,
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
      attempts: 3,
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
        8_000,
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
      attempts: 3,
      baseDelayMs: 350,
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

  let pumpfun: PumpFunCoinResponse | null = null;
  try {
    pumpfun = await fetchPumpFunMetadata(mint);
  } catch (error) {
    logger.warn("pumpfun_metadata_fetch_failed", {
      component: "pump_metadata",
      stage: "fetch_pumpfun_metadata",
      mint,
      errorCode: "pumpfun_metadata_fetch_failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
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

  let dexscreener: DexScreenerTokenMetadata | null = null;
  try {
    dexscreener = await fetchDexScreenerMetadata(mint);
  } catch (error) {
    logger.warn("dexscreener_metadata_fetch_failed", {
      component: "pump_metadata",
      stage: "fetch_dexscreener_metadata",
      mint,
      errorCode: "dexscreener_metadata_fetch_failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const needsHeliusFallback =
    (!pumpfunName && !dexscreener?.name) ||
    (!pumpfunSymbol && !dexscreener?.symbol) ||
    !pumpfunImage ||
    !pumpfunDescription;

  let heliusName: string | null = null;
  let heliusSymbol: string | null = null;
  let heliusImage: string | null = null;
  let heliusDescription: string | null = null;
  let heliusJsonUri: string | null = null;

  if (!pumpfun || needsHeliusFallback) {
    try {
      const helius = getHeliusClient();
      const asset = await helius.getAsset({ id: mint });
      heliusName = sanitizeString(asset.content?.metadata?.name);
      heliusSymbol = sanitizeString(asset.content?.metadata?.symbol);
      heliusImage = normalizeMaybeUrl(asset.content?.links?.image);
      heliusDescription = sanitizeString(asset.content?.metadata?.description);
      heliusJsonUri = normalizeMaybeUrl(asset.content?.json_uri);
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

  const name = pumpfunName ?? dexscreener?.name ?? heliusName ?? mint.slice(0, 6);
  const symbol = pumpfunSymbol ?? dexscreener?.symbol ?? heliusSymbol ?? "UNKNOWN";
  const image = pumpfunImage ?? heliusImage ?? null;
  const description = pumpfunDescription ?? heliusDescription ?? null;
  const jsonUri = pumpfunJsonUri ?? heliusJsonUri ?? undefined;

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
