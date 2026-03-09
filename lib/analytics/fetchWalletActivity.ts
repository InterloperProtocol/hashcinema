import { fetchRecentTransactionsByWallet } from "@/lib/helius/fetch-transactions";
import type { EnhancedTransaction } from "helius-sdk/enhanced/types";
import { AnalysisRangeHours } from "./types";

export async function fetchWalletActivity(input: {
  wallet: string;
  rangeHours: AnalysisRangeHours;
}): Promise<EnhancedTransaction[]> {
  const rangeDays = input.rangeHours / 24;
  return fetchRecentTransactionsByWallet(input.wallet, rangeDays);
}
