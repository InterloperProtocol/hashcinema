import { PublicKey } from "@solana/web3.js";

import { getOrFetchPumpMetadata } from "@/lib/pump/metadata";
import { fetchWithTimeout } from "@/lib/network/http";
import {
  isRetryableHttpStatus,
  RetryableError,
  withRetry,
} from "@/lib/network/retry";
import {
  RequestedTokenChain,
  SupportedTokenChain,
  TokenLink,
  TokenMarketSnapshot,
} from "@/lib/types/domain";

const DEXSCREENER_API_BASE_URL = "https://api.dexscreener.com";
const METADATA_TIMEOUT_MS = 6_000;
const RETRY_ATTEMPTS = 2;
const SUPPORTED_EVM_CHAINS: SupportedTokenChain[] = ["ethereum", "bsc", "base"];

interface DexScreenerPairResponse {
  chainId?: string;
  dexId?: string;
  url?: string;
  priceUsd?: number | string;
  fdv?: number | string;
  marketCap?: number | string;
  liquidity?: {
    usd?: number | string;
  };
  volume?: {
    h24?: number | string;
  };
  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
  info?: {
    imageUrl?: string;
    websites?: Array<{
      label?: string;
      url?: string;
    }>;
    socials?: Array<{
      type?: string;
      url?: string;
    }>;
  };
}

export interface ResolvedMemecoinMetadata {
  chain: SupportedTokenChain;
  address: string;
  name: string;
  symbol: string;
  image: string | null;
  description: string | null;
  isPump: boolean;
  links: TokenLink[];
  marketSnapshot: TokenMarketSnapshot;
}

function sanitizeString(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  return trimmed.length ? trimmed : null;
}

function shortAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toFiniteNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string") {
    const parsed = Number.parseFloat(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeHttpUrl(input: unknown): string | null {
  const value = sanitizeString(input);
  if (!value) return null;

  if (value.toLowerCase().startsWith("ipfs://")) {
    const path = value.replace(/^ipfs:\/\//i, "").replace(/^\/+/, "");
    return path ? `https://ipfs.io/ipfs/${path}` : null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

export function isValidSolanaTokenAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidEvmTokenAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function detectAddressFamily(address: string): "solana" | "evm" | null {
  if (isValidSolanaTokenAddress(address)) {
    return "solana";
  }

  if (isValidEvmTokenAddress(address)) {
    return "evm";
  }

  return null;
}

async function fetchDexScreenerPairs(
  chain: SupportedTokenChain,
  address: string,
): Promise<DexScreenerPairResponse[]> {
  const url = `${DEXSCREENER_API_BASE_URL}/tokens/v1/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`;

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
        METADATA_TIMEOUT_MS,
      );

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        const message = `DexScreener token lookup failed (${response.status}) for ${chain}:${address}`;
        if (isRetryableHttpStatus(response.status)) {
          throw new RetryableError(message);
        }
        return [];
      }

      const payload = (await response.json()) as unknown;
      return Array.isArray(payload) ? (payload as DexScreenerPairResponse[]) : [];
    },
    {
      attempts: RETRY_ATTEMPTS,
      baseDelayMs: 350,
      maxDelayMs: 2_500,
      shouldRetry: (error) =>
        error instanceof RetryableError ||
        (error instanceof TypeError && error.message.length > 0),
    },
  );
}

function pairScore(pair: DexScreenerPairResponse): number {
  const liquidity = toFiniteNumber(pair.liquidity?.usd) ?? 0;
  const volume = toFiniteNumber(pair.volume?.h24) ?? 0;
  const marketCap = toFiniteNumber(pair.marketCap) ?? toFiniteNumber(pair.fdv) ?? 0;
  return liquidity * 100 + volume * 10 + marketCap;
}

function selectBestPair(pairs: DexScreenerPairResponse[]): DexScreenerPairResponse | null {
  if (!pairs.length) {
    return null;
  }

  return [...pairs].sort((left, right) => pairScore(right) - pairScore(left))[0] ?? null;
}

function buildLinks(pair: DexScreenerPairResponse | null): TokenLink[] {
  if (!pair) {
    return [];
  }

  const deduped = new Map<string, TokenLink>();
  const pairUrl = normalizeHttpUrl(pair.url);
  if (pairUrl) {
    deduped.set(pairUrl, {
      label: "DexScreener",
      url: pairUrl,
    });
  }

  for (const website of pair.info?.websites ?? []) {
    const url = normalizeHttpUrl(website.url);
    if (!url) continue;
    deduped.set(url, {
      label: sanitizeString(website.label) ?? "Website",
      url,
    });
  }

  for (const social of pair.info?.socials ?? []) {
    const url = normalizeHttpUrl(social.url);
    if (!url) continue;
    const label = sanitizeString(social.type)?.replace(/^\w/, (char) => char.toUpperCase());
    deduped.set(url, {
      label: label ?? "Social",
      url,
    });
  }

  return [...deduped.values()].slice(0, 5);
}

function buildMarketSnapshot(pair: DexScreenerPairResponse | null): TokenMarketSnapshot {
  return {
    priceUsd: pair ? toFiniteNumber(pair.priceUsd) : null,
    marketCapUsd: pair
      ? (toFiniteNumber(pair.marketCap) ?? toFiniteNumber(pair.fdv))
      : null,
    liquidityUsd: pair ? toFiniteNumber(pair.liquidity?.usd) : null,
    volume24hUsd: pair ? toFiniteNumber(pair.volume?.h24) : null,
    pairUrl: pair ? normalizeHttpUrl(pair.url) : null,
  };
}

async function resolveSolanaMemecoin(address: string): Promise<ResolvedMemecoinMetadata> {
  const [pump, pairs] = await Promise.all([
    getOrFetchPumpMetadata(address),
    fetchDexScreenerPairs("solana", address),
  ]);

  const bestPair = selectBestPair(pairs);
  const name =
    sanitizeString(pump.name) ??
    sanitizeString(bestPair?.baseToken?.name) ??
    `Solana token ${shortAddress(address)}`;
  const symbol =
    sanitizeString(pump.symbol) ??
    sanitizeString(bestPair?.baseToken?.symbol) ??
    "SOLMEME";

  return {
    chain: "solana",
    address,
    name,
    symbol,
    image:
      normalizeHttpUrl(pump.image) ??
      normalizeHttpUrl(bestPair?.info?.imageUrl),
    description: sanitizeString(pump.description),
    isPump: pump.isPump || sanitizeString(bestPair?.dexId)?.toLowerCase() === "pumpfun",
    links: buildLinks(bestPair),
    marketSnapshot: buildMarketSnapshot(bestPair),
  };
}

async function resolveEvmMemecoin(
  address: string,
  requestedChain: SupportedTokenChain | "auto",
): Promise<ResolvedMemecoinMetadata> {
  const chainsToTry =
    requestedChain === "auto" ? SUPPORTED_EVM_CHAINS : [requestedChain];

  const pairResults = await Promise.all(
    chainsToTry.map(async (chain) => ({
      chain,
      pairs: await fetchDexScreenerPairs(chain, address),
    })),
  );

  const best = pairResults
    .map(({ chain, pairs }) => ({
      chain,
      pair: selectBestPair(pairs),
    }))
    .sort((left, right) => pairScore(right.pair ?? {}) - pairScore(left.pair ?? {}))[0];

  const resolvedChain = best?.pair
    ? best.chain
    : requestedChain === "auto"
      ? "ethereum"
      : requestedChain;
  const pair = best?.pair ?? null;
  const symbol =
    sanitizeString(pair?.baseToken?.symbol) ??
    resolvedChain === "bsc"
      ? "BNBMEME"
      : "ETHMEME";

  return {
    chain: resolvedChain,
    address,
    name:
      sanitizeString(pair?.baseToken?.name) ??
      `${resolvedChain[0].toUpperCase()}${resolvedChain.slice(1)} memecoin ${shortAddress(address)}`,
    symbol,
    image: normalizeHttpUrl(pair?.info?.imageUrl),
    description: null,
    isPump: false,
    links: buildLinks(pair),
    marketSnapshot: buildMarketSnapshot(pair),
  };
}

export async function resolveMemecoinMetadata(input: {
  address: string;
  chain: RequestedTokenChain;
}): Promise<ResolvedMemecoinMetadata> {
  const address = input.address.trim();
  const family = detectAddressFamily(address);

  if (!family) {
    throw new Error("Provide a valid Solana mint or EVM contract address.");
  }

  if (family === "solana") {
    if (input.chain !== "auto" && input.chain !== "solana") {
      throw new Error("Solana mints only support the Solana chain option.");
    }

    return resolveSolanaMemecoin(address);
  }

  if (input.chain === "solana") {
    throw new Error("That address is EVM-formatted, not a Solana mint.");
  }

  return resolveEvmMemecoin(address, input.chain);
}
