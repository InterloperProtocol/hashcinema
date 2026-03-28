"use client";

import { ACTIVE_PACKAGE_TYPES, PACKAGE_CONFIG } from "@/lib/constants";
import { PackageType } from "@/lib/types/domain";

interface PackageSelectorProps {
  value: PackageType;
  onChange: (value: PackageType) => void;
  disabled?: boolean;
}

export function PackageSelector({
  value,
  onChange,
  disabled,
}: PackageSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <p className="cinema-kicker text-[0.68rem] font-semibold">Choose The Runtime</p>
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[#9e8f83]">
          30s / 60s
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {ACTIVE_PACKAGE_TYPES.map((packageType) => {
          const item = PACKAGE_CONFIG[packageType];
          const selected = item.packageType === value;
          return (
            <button
              key={item.packageType}
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.packageType)}
              className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                selected
                  ? "border-[rgba(255,197,97,0.44)] bg-[linear-gradient(180deg,rgba(255,197,97,0.16),rgba(255,116,71,0.08))] text-[#fff5e5] shadow-[0_18px_30px_rgba(255,116,71,0.12)]"
                  : "border-white/10 bg-[#120f11]/78 text-[#f1e2ca] hover:border-[rgba(255,197,97,0.28)] hover:bg-[#171214]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#a9998d]">
                    {item.label ?? `${item.videoSeconds}s`}
                  </p>
                  <p className="mt-2 text-sm text-[#dbcbbd]">{item.subtitle}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-[#b7a898]">
                  {item.videoSeconds}s
                </span>
              </div>
              <p className="font-display mt-4 text-3xl leading-none">{item.priceSol} SOL</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#b7a898]">
                Agent x402: ${item.priceUsdc} USDC
              </p>
              {selected ? (
                <p className="mt-3 text-[0.72rem] uppercase tracking-[0.22em] text-[#ffe4b0]">
                  selected
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
