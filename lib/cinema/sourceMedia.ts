export type SourceMediaProvider = "youtube" | "spotify";

export interface SourceMediaContext {
  sourceMediaUrl: string | null;
  sourceEmbedUrl: string | null;
  sourceMediaProvider: SourceMediaProvider | null;
  sourceTranscript: string | null;
}

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')]+/i;

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeUrlCandidate(value: string): string | null {
  const trimmed = value.trim().replace(/[)\].,;!?]+$/g, "");
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;
  try {
    const url = new URL(normalized);
    return url.toString();
  } catch {
    return null;
  }
}

export function extractSourceMediaUrl(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value?.trim()) {
      continue;
    }

    const match = value.match(URL_PATTERN);
    if (!match?.[0]) {
      continue;
    }

    const normalized = normalizeUrlCandidate(match[0]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function detectSourceMediaProvider(value?: string | null): SourceMediaProvider | null {
  const url = trimOrNull(value);
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host === "youtu.be" ||
      host.endsWith("youtube.com") ||
      host.endsWith("youtube-nocookie.com")
    ) {
      return "youtube";
    }

    if (host.endsWith("spotify.com")) {
      return "spotify";
    }
  } catch {
    return null;
  }

  return null;
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (host.endsWith("youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) {
        return parsed.searchParams.get("v");
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") {
        return parts[1] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function buildSourceEmbedUrl(
  provider: SourceMediaProvider,
  sourceMediaUrl: string,
): string {
  if (provider === "youtube") {
    const videoId = extractYouTubeVideoId(sourceMediaUrl);
    if (videoId) {
      return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`;
    }
  }

  if (provider === "spotify") {
    try {
      const parsed = new URL(sourceMediaUrl);
      const embedPath = parsed.pathname.replace(/^\/+/, "/embed/");
      return `https://open.spotify.com${embedPath}${parsed.search}`;
    } catch {
      return sourceMediaUrl;
    }
  }

  return sourceMediaUrl;
}

export function sourceMediaAudioPolicy(provider: SourceMediaProvider | null): "generated" | "source_track" {
  return provider === "youtube" || provider === "spotify" ? "source_track" : "generated";
}

function extractJsonArrayAfterMarker(html: string, marker: string): string | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const arrayStart = html.indexOf("[", markerIndex);
  if (arrayStart === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return html.slice(arrayStart, index + 1);
      }
    }
  }

  return null;
}

function parseVttTranscript(vtt: string): string {
  const chunks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (!current.length) {
      return;
    }
    const joined = current.join(" ").replace(/\s+/g, " ").trim();
    if (joined) {
      chunks.push(joined);
    }
    current = [];
  };

  for (const rawLine of vtt.split(/\r?\n+/)) {
    const line = rawLine.trim();
    if (
      !line ||
      line === "WEBVTT" ||
      /^NOTE\b/i.test(line) ||
      /^STYLE\b/i.test(line) ||
      /^REGION\b/i.test(line) ||
      /^\d+$/.test(line)
    ) {
      flush();
      continue;
    }

    if (line.includes("-->")) {
      continue;
    }

    current.push(line.replace(/<[^>]+>/g, ""));
  }

  flush();

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

async function fetchYoutubeTranscript(sourceMediaUrl: string): Promise<string | null> {
  const videoId = extractYouTubeVideoId(sourceMediaUrl);
  if (!videoId) {
    return null;
  }

  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(
    videoId,
  )}&hl=en&persist_hl=1&persist_gl=1`;
  const response = await fetch(watchUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const captionTracksJson = extractJsonArrayAfterMarker(html, '"captionTracks":');
  if (!captionTracksJson) {
    return null;
  }

  let captionTracks: Array<{
    baseUrl?: string;
    languageCode?: string;
    kind?: string;
    name?: { simpleText?: string };
  }> = [];

  try {
    captionTracks = JSON.parse(captionTracksJson) as typeof captionTracks;
  } catch {
    return null;
  }

  if (!captionTracks.length) {
    return null;
  }

  const preferredTrack =
    captionTracks.find(
      (track) =>
        typeof track.languageCode === "string" &&
        /^(en|en-[A-Z]{2})/i.test(track.languageCode) &&
        track.kind !== "asr",
    ) ??
    captionTracks.find(
      (track) => typeof track.languageCode === "string" && /^(en|en-[A-Z]{2})/i.test(track.languageCode),
    ) ??
    captionTracks[0];

  if (!preferredTrack?.baseUrl) {
    return null;
  }

  const transcriptUrl = preferredTrack.baseUrl.includes("fmt=")
    ? preferredTrack.baseUrl
    : `${preferredTrack.baseUrl}${preferredTrack.baseUrl.includes("?") ? "&" : "?"}fmt=vtt`;
  const transcriptResponse = await fetch(transcriptUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      accept: "text/vtt,text/plain,application/xml",
    },
  });

  if (!transcriptResponse.ok) {
    return null;
  }

  const transcriptText = await transcriptResponse.text();
  const parsedTranscript = parseVttTranscript(transcriptText);
  return parsedTranscript || null;
}

export async function resolveSourceMediaContext(input: {
  sourceMediaUrl?: string | null;
  subjectName?: string | null;
  subjectDescription?: string | null;
  requestedPrompt?: string | null;
  sourceTranscript?: string | null;
}): Promise<SourceMediaContext> {
  const sourceMediaUrl =
    normalizeUrlCandidate(
      extractSourceMediaUrl([
        input.sourceMediaUrl,
        input.subjectName,
        input.subjectDescription,
        input.requestedPrompt,
      ]) ?? "",
    ) ?? null;
  const sourceMediaProvider = detectSourceMediaProvider(sourceMediaUrl);
  const sourceEmbedUrl =
    sourceMediaUrl && sourceMediaProvider
      ? buildSourceEmbedUrl(sourceMediaProvider, sourceMediaUrl)
      : sourceMediaUrl;
  const explicitTranscript = trimOrNull(input.sourceTranscript);
  const sourceTranscript =
    explicitTranscript ??
    (sourceMediaProvider === "youtube" && sourceMediaUrl
      ? await fetchYoutubeTranscript(sourceMediaUrl)
      : null);

  return {
    sourceMediaUrl,
    sourceEmbedUrl,
    sourceMediaProvider,
    sourceTranscript,
  };
}
