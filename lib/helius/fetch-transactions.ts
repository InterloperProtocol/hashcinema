import { getHeliusClient } from "@/lib/helius/client";
import type { EnhancedTransaction } from "helius-sdk/enhanced/types";

const PAGE_SIZE = 100;
const MAX_TRANSACTIONS = 800;
const MAX_PAGES = 12;

export async function fetchRecentTransactionsByWallet(
  wallet: string,
  rangeDays: number,
): Promise<EnhancedTransaction[]> {
  const helius = getHeliusClient();
  const cutoffTs = Math.floor(Date.now() / 1000) - rangeDays * 24 * 60 * 60;

  const results: EnhancedTransaction[] = [];
  let beforeSignature: string | undefined;
  let page = 0;

  while (page < MAX_PAGES && results.length < MAX_TRANSACTIONS) {
    const batch = await helius.enhanced.getTransactionsByAddress({
      address: wallet,
      beforeSignature,
      limit: PAGE_SIZE,
      sortOrder: "desc",
    });

    if (!batch.length) {
      break;
    }

    results.push(...batch);
    const oldest = batch[batch.length - 1];
    beforeSignature = oldest?.signature;
    page += 1;

    if (!beforeSignature) {
      break;
    }

    if (oldest?.timestamp && oldest.timestamp < cutoffTs) {
      break;
    }
  }

  return results.filter((tx) => (tx.timestamp ?? 0) >= cutoffTs);
}
