"use client";

import { TOKEN_VIDEO_STYLE_PRESETS } from "@/lib/memecoins/styles";
import { VideoStyleId } from "@/lib/types/domain";

interface StylePresetSelectorProps {
  value: VideoStyleId;
  onChange: (value: VideoStyleId) => void;
  suggested?: VideoStyleId[];
  disabled?: boolean;
}

export function StylePresetSelector({
  value,
  onChange,
  suggested = [],
  disabled,
}: StylePresetSelectorProps) {
  const suggestedSet = new Set(suggested);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <p className="cinema-kicker text-[0.68rem] font-semibold">Choose The Style</p>
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[#9e8f83]">
          pick a cut
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TOKEN_VIDEO_STYLE_PRESETS.map((preset) => {
          const selected = preset.id === value;
          const isSuggested = suggestedSet.has(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.id)}
              className={`rounded-[1.35rem] border px-4 py-4 text-left transition ${
                selected
                  ? "border-[rgba(152,200,191,0.55)] bg-[linear-gradient(180deg,rgba(152,200,191,0.18),rgba(135,219,255,0.08))] text-[#f0fffb]"
                  : "border-white/10 bg-[#120f11]/78 text-[#f1e2ca] hover:border-[rgba(152,200,191,0.28)] hover:bg-[#171214]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#a9998d]">
                    {preset.shortLabel}
                  </p>
                  <p className="mt-2 font-display text-2xl leading-none">
                    {preset.label}
                  </p>
                </div>
                {isSuggested ? (
                  <span className="rounded-full border border-[#98c8bf]/30 bg-[#98c8bf]/10 px-2 py-1 text-[0.6rem] uppercase tracking-[0.18em] text-[#d8f6ef]">
                    suggested
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#d3c4b6]">
                {preset.summary}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-[#aa9a8d]">
                {preset.directorNote}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
