import {
  extractLamportsToWalletFromParsedTransaction,
  extractMemoFromParsedTransaction,
} from "@/lib/payments/onchain-verify";
import { ParsedTransactionWithMeta } from "@solana/web3.js";

function mockParsedTransaction(): ParsedTransactionWithMeta {
  return {
    slot: 1,
    blockTime: 1,
    meta: {
      err: null,
      fee: 5000,
      preBalances: [],
      postBalances: [],
      innerInstructions: [],
      logMessages: [],
      preTokenBalances: [],
      postTokenBalances: [],
      loadedAddresses: {
        readonly: [],
        writable: [],
      },
    },
    transaction: {
      signatures: ["sig-1"],
      message: {
        accountKeys: [],
        instructions: [
          {
            program: "spl-memo",
            programId: { toBase58: () => "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" },
            parsed: "job-123",
          },
          {
            program: "system",
            programId: { toBase58: () => "11111111111111111111111111111111" },
            parsed: {
              type: "transfer",
              info: {
                source: "sender",
                destination: "PLATFORM_WALLET",
                lamports: 22_000_000,
              },
            },
          },
        ],
        recentBlockhash: "blockhash",
      },
    },
    version: 0,
  } as unknown as ParsedTransactionWithMeta;
}

describe("on-chain parser helpers", () => {
  it("extracts memo from parsed transaction", () => {
    const memo = extractMemoFromParsedTransaction(mockParsedTransaction());
    expect(memo).toBe("job-123");
  });

  it("extracts lamports transferred to payment wallet", () => {
    const lamports = extractLamportsToWalletFromParsedTransaction(
      mockParsedTransaction(),
      "PLATFORM_WALLET",
    );
    expect(lamports).toBe(22_000_000);
  });

  it("returns safe defaults for null transactions", () => {
    expect(extractMemoFromParsedTransaction(null)).toBeNull();
    expect(extractLamportsToWalletFromParsedTransaction(null, "PLATFORM_WALLET")).toBe(0);
  });
});
