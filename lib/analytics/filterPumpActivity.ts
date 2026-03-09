import { extractPumpTrades } from "@/lib/pump/filter";
import type { EnhancedTransaction } from "helius-sdk/enhanced/types";
import { PumpTradeLike } from "./types";

export async function filterPumpActivity(input: {
  wallet: string;
  transactions: EnhancedTransaction[];
}): Promise<PumpTradeLike[]> {
  const trades = await extractPumpTrades(input.wallet, input.transactions);

  // extractPumpTrades already excludes NFTs/non-Pump token transfers.
  return trades.map((trade) => ({
    timestamp: trade.timestamp,
    signature: trade.signature,
    source: trade.source,
    mint: trade.mint,
    symbol: trade.symbol,
    name: trade.name,
    image: trade.image,
    side: trade.side,
    tokenAmount: trade.tokenAmount,
    solAmount: trade.solAmount,
  }));
}
