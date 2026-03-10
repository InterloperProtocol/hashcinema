import { getHeliusClient } from "@/lib/helius/client";
import { getPumpMetadata, upsertPumpMetadata } from "@/lib/jobs/repository";
import { fetchWithTimeout } from "@/lib/network/http";
import {
  isRetryableHttpStatus,
  RetryableError,
  withRetry,
} from "@/lib/network/retry";
import { PumpMetadataCacheDocument } from "@/lib/types/domain";

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const PUMP_FUN_API_BASE_URL = "https://frontend-api.pump.fun";

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

  const pumpfun = await fetchPumpFunMetadata(mint);
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
    !pumpfunName || !pumpfunSymbol || !pumpfunImage || !pumpfunDescription;

  let heliusName: string | null = null;
  let heliusSymbol: string | null = null;
  let heliusImage: string | null = null;
  let heliusDescription: string | null = null;
  let heliusJsonUri: string | null = null;

  if (!pumpfun || needsHeliusFallback) {
    const helius = getHeliusClient();
    const asset = await helius.getAsset({ id: mint });
    heliusName = sanitizeString(asset.content?.metadata?.name);
    heliusSymbol = sanitizeString(asset.content?.metadata?.symbol);
    heliusImage = normalizeMaybeUrl(asset.content?.links?.image);
    heliusDescription = sanitizeString(asset.content?.metadata?.description);
    heliusJsonUri = normalizeMaybeUrl(asset.content?.json_uri);
  }

  const name = pumpfunName ?? heliusName ?? mint.slice(0, 6);
  const symbol = pumpfunSymbol ?? heliusSymbol ?? "UNKNOWN";
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
  await upsertPumpMetadata(doc);

  return {
    mint,
    name,
    symbol,
    image,
    description,
    isPump:
      Boolean(pumpfun) ||
      inferPumpSignal({ name, symbol, image, description, jsonUri }),
  };
}
