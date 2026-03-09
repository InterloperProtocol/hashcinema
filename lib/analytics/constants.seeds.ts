import { NormalizedTrade, SeedWalletBehaviorProfile } from "./types";

interface SeedTradeInput {
  signature: string;
  timestamp: number;
  mint: string;
  symbol: string;
  side: "BUY" | "SELL";
  solAmount: number;
  tokenAmount: number;
  holdDurationMinutes?: number | null;
  pnlSol?: number | null;
  isOpenPosition?: boolean;
}

function seedTrade(input: SeedTradeInput): NormalizedTrade {
  return {
    signature: input.signature,
    timestamp: input.timestamp,
    mint: input.mint,
    symbol: input.symbol,
    name: input.symbol,
    side: input.side,
    solAmount: input.solAmount,
    tokenAmount: input.tokenAmount,
    priceEstimate: input.tokenAmount > 0 ? input.solAmount / input.tokenAmount : undefined,
    holdDurationMinutes: input.side === "SELL" ? (input.holdDurationMinutes ?? null) : null,
    pnlSol: input.side === "SELL" ? (input.pnlSol ?? null) : null,
    isOpenPosition: input.isOpenPosition ?? false,
    isPumpToken: true,
  };
}

const T = 1_739_800_000;

export const SEED_WALLET_PROFILES: SeedWalletBehaviorProfile[] = [
  {
    id: "chaotic-overtrader",
    label: "Chaotic Overtrader",
    description: "Rapid-fire rotation, emotional re-entry, lots of overmanagement.",
    wallet: "Cha0tic111111111111111111111111111111111111111",
    rangeHours: 24,
    normalizedTrades: [
      seedTrade({ signature: "co-1", timestamp: T + 60, mint: "MINT-A", symbol: "GOB", side: "BUY", solAmount: 0.8, tokenAmount: 120_000 }),
      seedTrade({ signature: "co-2", timestamp: T + 420, mint: "MINT-A", symbol: "GOB", side: "SELL", solAmount: 0.65, tokenAmount: 120_000, holdDurationMinutes: 6, pnlSol: -0.15 }),
      seedTrade({ signature: "co-3", timestamp: T + 780, mint: "MINT-B", symbol: "WEN", side: "BUY", solAmount: 1.1, tokenAmount: 92_000 }),
      seedTrade({ signature: "co-4", timestamp: T + 1_020, mint: "MINT-B", symbol: "WEN", side: "SELL", solAmount: 0.92, tokenAmount: 92_000, holdDurationMinutes: 4, pnlSol: -0.18 }),
      seedTrade({ signature: "co-5", timestamp: T + 1_260, mint: "MINT-C", symbol: "MOOD", side: "BUY", solAmount: 1.4, tokenAmount: 141_000 }),
      seedTrade({ signature: "co-6", timestamp: T + 1_980, mint: "MINT-C", symbol: "MOOD", side: "SELL", solAmount: 1.75, tokenAmount: 141_000, holdDurationMinutes: 12, pnlSol: 0.35 }),
      seedTrade({ signature: "co-7", timestamp: T + 2_160, mint: "MINT-D", symbol: "COPE", side: "BUY", solAmount: 2.2, tokenAmount: 201_000 }),
      seedTrade({ signature: "co-8", timestamp: T + 2_460, mint: "MINT-D", symbol: "COPE", side: "SELL", solAmount: 1.5, tokenAmount: 201_000, holdDurationMinutes: 5, pnlSol: -0.7 }),
    ],
  },
  {
    id: "early-narrative-trader",
    label: "Early Narrative Trader",
    description: "Early positioning with calmer exits and thesis-driven holds.",
    wallet: "Early111111111111111111111111111111111111111111",
    rangeHours: 48,
    normalizedTrades: [
      seedTrade({ signature: "en-1", timestamp: T + 600, mint: "MINT-R1", symbol: "SAGA", side: "BUY", solAmount: 1.2, tokenAmount: 210_000 }),
      seedTrade({ signature: "en-2", timestamp: T + 6_600, mint: "MINT-R1", symbol: "SAGA", side: "SELL", solAmount: 2.35, tokenAmount: 210_000, holdDurationMinutes: 100, pnlSol: 1.15 }),
      seedTrade({ signature: "en-3", timestamp: T + 9_000, mint: "MINT-R2", symbol: "LORE", side: "BUY", solAmount: 0.9, tokenAmount: 154_000 }),
      seedTrade({ signature: "en-4", timestamp: T + 18_600, mint: "MINT-R2", symbol: "LORE", side: "SELL", solAmount: 1.62, tokenAmount: 154_000, holdDurationMinutes: 160, pnlSol: 0.72 }),
      seedTrade({ signature: "en-5", timestamp: T + 30_000, mint: "MINT-R4", symbol: "ARC", side: "BUY", solAmount: 1.0, tokenAmount: 178_000, isOpenPosition: true }),
    ],
  },
  {
    id: "stubborn-bagholder",
    label: "Stubborn Bagholder",
    description: "Averages down and carries bags through long drawdowns.",
    wallet: "Bag11111111111111111111111111111111111111111111",
    rangeHours: 72,
    normalizedTrades: [
      seedTrade({ signature: "sb-1", timestamp: T + 300, mint: "MINT-BAG", symbol: "FAITH", side: "BUY", solAmount: 1.0, tokenAmount: 160_000 }),
      seedTrade({ signature: "sb-2", timestamp: T + 3_600, mint: "MINT-BAG", symbol: "FAITH", side: "BUY", solAmount: 1.2, tokenAmount: 220_000 }),
      seedTrade({ signature: "sb-3", timestamp: T + 10_800, mint: "MINT-BAG", symbol: "FAITH", side: "BUY", solAmount: 1.1, tokenAmount: 260_000 }),
      seedTrade({ signature: "sb-4", timestamp: T + 48_000, mint: "MINT-BAG", symbol: "FAITH", side: "SELL", solAmount: 1.75, tokenAmount: 640_000, holdDurationMinutes: 790, pnlSol: -1.55 }),
      seedTrade({ signature: "sb-5", timestamp: T + 64_200, mint: "MINT-HOPE", symbol: "COPE", side: "BUY", solAmount: 0.8, tokenAmount: 190_000, isOpenPosition: true }),
    ],
  },
  {
    id: "pump-chaser",
    label: "Pump Chaser",
    description: "Late momentum entries with quick fear exits.",
    wallet: "Chase11111111111111111111111111111111111111111",
    rangeHours: 24,
    normalizedTrades: [
      seedTrade({ signature: "pc-1", timestamp: T + 1_200, mint: "MINT-P1", symbol: "PUMPY", side: "BUY", solAmount: 1.3, tokenAmount: 74_000 }),
      seedTrade({ signature: "pc-2", timestamp: T + 1_560, mint: "MINT-P1", symbol: "PUMPY", side: "SELL", solAmount: 1.05, tokenAmount: 74_000, holdDurationMinutes: 6, pnlSol: -0.25 }),
      seedTrade({ signature: "pc-3", timestamp: T + 1_800, mint: "MINT-P2", symbol: "MOONR", side: "BUY", solAmount: 1.8, tokenAmount: 88_000 }),
      seedTrade({ signature: "pc-4", timestamp: T + 2_040, mint: "MINT-P2", symbol: "MOONR", side: "SELL", solAmount: 1.45, tokenAmount: 88_000, holdDurationMinutes: 4, pnlSol: -0.35 }),
      seedTrade({ signature: "pc-5", timestamp: T + 2_220, mint: "MINT-P3", symbol: "HOT", side: "BUY", solAmount: 2.0, tokenAmount: 102_000 }),
      seedTrade({ signature: "pc-6", timestamp: T + 2_640, mint: "MINT-P3", symbol: "HOT", side: "SELL", solAmount: 2.15, tokenAmount: 102_000, holdDurationMinutes: 7, pnlSol: 0.15 }),
    ],
  },
  {
    id: "improbable-comeback-merchant",
    label: "Improbable Comeback Merchant",
    description: "Early losses, then one giant recovery sequence.",
    wallet: "Comeback111111111111111111111111111111111111111",
    rangeHours: 48,
    normalizedTrades: [
      seedTrade({ signature: "ic-1", timestamp: T + 900, mint: "MINT-CB1", symbol: "PAIN", side: "BUY", solAmount: 1.0, tokenAmount: 180_000 }),
      seedTrade({ signature: "ic-2", timestamp: T + 1_320, mint: "MINT-CB1", symbol: "PAIN", side: "SELL", solAmount: 0.72, tokenAmount: 180_000, holdDurationMinutes: 7, pnlSol: -0.28 }),
      seedTrade({ signature: "ic-3", timestamp: T + 1_500, mint: "MINT-CB2", symbol: "PANIC", side: "BUY", solAmount: 1.4, tokenAmount: 210_000 }),
      seedTrade({ signature: "ic-4", timestamp: T + 1_860, mint: "MINT-CB2", symbol: "PANIC", side: "SELL", solAmount: 0.95, tokenAmount: 210_000, holdDurationMinutes: 6, pnlSol: -0.45 }),
      seedTrade({ signature: "ic-5", timestamp: T + 2_040, mint: "MINT-CB3", symbol: "REBORN", side: "BUY", solAmount: 1.8, tokenAmount: 245_000 }),
      seedTrade({ signature: "ic-6", timestamp: T + 9_000, mint: "MINT-CB3", symbol: "REBORN", side: "SELL", solAmount: 3.95, tokenAmount: 245_000, holdDurationMinutes: 116, pnlSol: 2.15 }),
    ],
  },
];
