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
        content: `Build a cinematic script from this factual wallet story JSON:\n${JSON.stringify(
          story,
        )}`,
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

  return {
    hookLine: parsed.hookLine,
    scenes: normalizedScenes,
  };
}
