"use client";

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
}

export function VideoPlayer({ src, poster }: VideoPlayerProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
      <video
        src={src}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full"
      />
    </div>
  );
}
