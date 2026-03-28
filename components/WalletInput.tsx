"use client";

interface WalletInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function WalletInput({ value, onChange, disabled }: WalletInputProps) {
  return (
    <div className="space-y-3">
      <label
        htmlFor="wallet-address"
        className="cinema-kicker block text-[0.68rem] font-semibold"
      >
        Token Mint / Contract Address
      </label>
      <input
        id="wallet-address"
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste Solana mint or EVM contract..."
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.trim())}
        className="w-full rounded-2xl border border-white/10 bg-[#110d0d]/90 px-4 py-4 text-sm text-[#fff3dd] outline-none transition placeholder:text-[#8e7f74] focus:border-[var(--accent-cool)] focus:ring-2 focus:ring-[rgba(135,219,255,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        One address only. We resolve Pump metadata on Solana and DexScreener metadata
        across Ethereum, BNB Chain, and Base without wallet connect.
      </p>
    </div>
  );
}
