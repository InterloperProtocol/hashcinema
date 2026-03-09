"use client";

import { PACKAGE_CONFIG } from "@/lib/constants";
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
    <div className="space-y-2">
      <p className="text-sm font-medium tracking-wide text-zinc-200">Package</p>
      <div className="grid gap-3 md:grid-cols-3">
        {Object.values(PACKAGE_CONFIG).map((item) => {
          const selected = item.packageType === value;
          return (
            <button
              key={item.packageType}
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.packageType)}
              className={`rounded-xl border px-4 py-4 text-left transition ${
                selected
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-100"
                  : "border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:border-zinc-500"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">
                {item.rangeDays} Day{item.rangeDays > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-2xl font-semibold">{item.priceSol} SOL</p>
              <p className="mt-1 text-xs text-zinc-400">
                {item.videoSeconds}s cinematic video
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
