import { getHeliusClient } from "@/lib/helius/client";
import { getPumpMetadata, upsertPumpMetadata } from "@/lib/jobs/repository";
import { PumpMetadataCacheDocument } from "@/lib/types/domain";

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

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

  const helius = getHeliusClient();
  const asset = await helius.getAsset({ id: mint });

  const name = asset.content?.metadata?.name ?? mint.slice(0, 6);
  const symbol = asset.content?.metadata?.symbol ?? "UNKNOWN";
  const image = asset.content?.links?.image ?? null;
  const description = asset.content?.metadata?.description ?? null;
  const jsonUri = asset.content?.json_uri;

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
    isPump: inferPumpSignal({ name, symbol, image, description, jsonUri }),
  };
}
