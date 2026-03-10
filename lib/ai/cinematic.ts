import { openRouterJson } from "@/lib/ai/openrouter";
import {
  CinematicScene,
  GeneratedCinematicScript,
  WalletStory,
} from "@/lib/types/domain";
import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";

const sceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  visualPrompt: z.string().min(10),
  narration: z.string().min(10),
  durationSeconds: z.number().int().positive(),
  imageUrl: z.string().url().nullable().optional(),
});

const scriptSchema = z.object({
  hookLine: z.string().min(10),
  scenes: z.array(sceneSchema).min(3).max(12),
});

interface TokenImageReference {
  mint: string;
  symbol: string;
  name: string | null;
  imageUrl: string;
  tradeCount: number;
  lastSeenTimestamp: number;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildPumpImageReferences(story: WalletStory): TokenImageReference[] {
  const byMint = new Map<string, TokenImageReference>();

  for (const item of story.timeline) {
    if (!isHttpUrl(item.image)) {
      continue;
    }

    const existing = byMint.get(item.mint);
    if (existing) {
      existing.tradeCount += 1;
      existing.lastSeenTimestamp = Math.max(existing.lastSeenTimestamp, item.timestamp);
      continue;
    }

    byMint.set(item.mint, {
      mint: item.mint,
      symbol: item.symbol,
      name: item.name ?? null,
      imageUrl: item.image,
      tradeCount: 1,
      lastSeenTimestamp: item.timestamp,
    });
  }

  return [...byMint.values()]
    .sort((a, b) => {
      if (b.tradeCount !== a.tradeCount) {
        return b.tradeCount - a.tradeCount;
      }
      return b.lastSeenTimestamp - a.lastSeenTimestamp;
    })
    .slice(0, 8);
}

export function assignSceneImageUrls(
  scenes: CinematicScene[],
  imagePool: string[],
): CinematicScene[] {
  const dedupedPool = [...new Set(imagePool.filter((url) => isHttpUrl(url)))];

  if (!dedupedPool.length) {
    return scenes.map((scene) => ({
      ...scene,
      imageUrl: isHttpUrl(scene.imageUrl) ? scene.imageUrl : null,
    }));
  }

  return scenes.map((scene, index) => ({
    ...scene,
    imageUrl:
      isHttpUrl(scene.imageUrl) ? scene.imageUrl : dedupedPool[index % dedupedPool.length]!,
  }));
}

function normalizeSceneDurations(
  scenes: CinematicScene[],
  targetDuration: number,
): CinematicScene[] {
  const total = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (total <= 0) {
    const equal = Math.max(1, Math.floor(targetDuration / scenes.length));
    return scenes.map((scene) => ({ ...scene, durationSeconds: equal }));
  }

  const scaled = scenes.map((scene) => ({
    ...scene,
    durationSeconds: Math.max(
      2,
      Math.round((scene.durationSeconds / total) * targetDuration),
    ),
  }));

  const scaledTotal = scaled.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const diff = targetDuration - scaledTotal;
  if (diff !== 0 && scaled.length) {
    scaled[scaled.length - 1]!.durationSeconds += diff;
  }

  return scaled;
}

export async function generateCinematicScript(
  story: WalletStory,
): Promise<GeneratedCinematicScript> {
  const templatePath = path.join(
    process.cwd(),
    "prompts",
    "cinematic_prompt_template.md",
  );
  const template = await readFile(templatePath, "utf8");
  const tokenImageReferences = buildPumpImageReferences(story);
  const imageReferencePayload = tokenImageReferences.map((reference) => ({
    mint: reference.mint,
    symbol: reference.symbol,
    name: reference.name,
    imageUrl: reference.imageUrl,
    tradeCount: reference.tradeCount,
  }));

  const raw = await openRouterJson<unknown>({
    temperature: 0.35,
    maxTokens: 1600,
    messages: [
      {
        role: "system",
        content: template,
      },
      {
        role: "user",
        content:
          `Build a cinematic script from this factual wallet story JSON:\n${JSON.stringify(story)}` +
          `\n\nPump.fun token image metadata to use in scene imageUrl fields when relevant:\n${JSON.stringify(imageReferencePayload)}`,
      },
    ],
  });

  const parsed = scriptSchema.parse(raw);
  const normalizedScenes = normalizeSceneDurations(
    parsed.scenes.map((scene) => ({
      ...scene,
      imageUrl: scene.imageUrl ?? null,
    })),
    story.durationSeconds,
  );
  const scenesWithImages = assignSceneImageUrls(
    normalizedScenes,
    tokenImageReferences.map((reference) => reference.imageUrl),
  );

  return {
    hookLine: parsed.hookLine,
    scenes: scenesWithImages,
  };
}
