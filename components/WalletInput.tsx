"use client";

interface WalletInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function WalletInput({ value, onChange, disabled }: WalletInputProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="wallet-address"
        className="text-sm font-medium tracking-wide text-zinc-200"
      >
        Solana Wallet Address
      </label>
      <input
        id="wallet-address"
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste wallet address..."
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.trim())}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none ring-cyan-500 transition focus:border-cyan-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p className="text-xs text-zinc-400">
        No wallet connect required. We only analyze Pump memecoin activity.
      </p>
    </div>
  );
}
