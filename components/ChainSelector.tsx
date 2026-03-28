"use client";

import { RequestedTokenChain } from "@/lib/types/domain";

const CHAIN_OPTIONS: Array<{
  value: RequestedTokenChain;
  label: string;
  description: string;
}> = [
  {
    value: "auto",
    label: "Auto",
    description: "Detect Solana, Ethereum, BNB Chain, or Base from the address.",
  },
  {
    value: "solana",
    label: "Solana",
    description: "Use Pump metadata when available and treat the address as a mint.",
  },
  {
    value: "ethereum",
    label: "Ethereum",
    description: "Force the address to resolve as an Ethereum memecoin.",
  },
  {
    value: "bsc",
    label: "BNB Chain",
    description: "Force the address to resolve as a BNB Chain memecoin.",
  },
  {
    value: "base",
    label: "Base",
    description: "Force the address to resolve as a Base memecoin.",
  },
];

interface ChainSelectorProps {
  value: RequestedTokenChain;
  onChange: (value: RequestedTokenChain) => void;
  disabled?: boolean;
}

export function ChainSelector({ value, onChange, disabled }: ChainSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <p className="cinema-kicker text-[0.68rem] font-semibold">Choose The Chain</p>
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[#9e8f83]">
          multichain
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {CHAIN_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`rounded-[1.2rem] border px-3 py-3 text-left transition ${
                selected
                  ? "border-[rgba(152,200,191,0.55)] bg-[linear-gradient(180deg,rgba(152,200,191,0.18),rgba(135,219,255,0.08))] text-[#f0fffb]"
                  : "border-white/10 bg-[#120f11]/78 text-[#f1e2ca] hover:border-[rgba(152,200,191,0.28)] hover:bg-[#171214]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-[#a9998d]">
                {option.label}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#cbbcad]">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
