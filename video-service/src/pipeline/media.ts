import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { Storage } from "@google-cloud/storage";
import { getVideoServiceBucket } from "../firebase";
import { getVideoServiceEnv } from "../env";

export function buildConcatManifest(paths: string[]): string {
  return paths
    .map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`)
    .join("\n");
}

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} failed with code ${code}: ${stderr}`));
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeIfExists(filePath: string): Promise<void> {
  await fs.rm(filePath, { force: true });
}

async function cleanupSourceArtifacts(workingDir: string): Promise<void> {
  const entries = await fs.readdir(workingDir);
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith("source-media."))
      .map((entry) => removeIfExists(path.join(workingDir, entry))),
  );
}

async function findArtifact(
  workingDir: string,
  prefix: string,
  extensions: string[],
): Promise<string | null> {
  const entries = await fs.readdir(workingDir);
  const allowed = new Set(extensions.map((extension) => extension.toLowerCase()));
  const match = entries.find((entry) => {
    if (!entry.startsWith(`${prefix}.`)) {
      return false;
    }
    return allowed.has(path.extname(entry).toLowerCase());
  });

  return match ? path.join(workingDir, match) : null;
}

function parseGcsUri(uri: string): { bucket: string; objectPath: string } {
  const match = uri.match(/^g(?:cs|s):\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid gcs uri: ${uri}`);
  }
  return {
    bucket: match[1]!,
    objectPath: match[2]!,
  };
}

async function downloadFromUri(uri: string, destination: string): Promise<void> {
  if (uri.startsWith("gcs://") || uri.startsWith("gs://")) {
    const storage = new Storage();
    const { bucket, objectPath } = parseGcsUri(uri);
    await storage.bucket(bucket).file(objectPath).download({ destination });
    return;
  }

  if (uri.startsWith("data:")) {
    const match = uri.match(/^data:.*?;base64,(.+)$/);
    if (!match) {
      throw new Error("Unsupported data URI for clip download.");
    }
    await fs.writeFile(destination, Buffer.from(match[1]!, "base64"));
    return;
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to download clip (${response.status}): ${uri}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, data);
}

export async function stageClipFiles(input: {
  clipUris: string[];
  workingDir?: string;
}): Promise<{ directory: string; clipPaths: string[] }> {
  const rootDir = input.workingDir ?? (await fs.mkdtemp(path.join(os.tmpdir(), "veo-render-")));
  const clipPaths: string[] = [];

  for (let index = 0; index < input.clipUris.length; index += 1) {
    const destination = path.join(rootDir, `clip-${index + 1}.mp4`);
    await downloadFromUri(input.clipUris[index]!, destination);
    clipPaths.push(destination);
  }

  return { directory: rootDir, clipPaths };
}

export async function downloadSourceMediaArtifacts(input: {
  sourceUrls: string[];
  workingDir: string;
}): Promise<{ audioPath: string; thumbnailPath: string | null }> {
  const env = getVideoServiceEnv();
  const candidateUrls = [...new Set(input.sourceUrls.map((value) => value.trim()).filter(Boolean))];

  if (!candidateUrls.length) {
    throw new Error("No source media URL was provided for source audio download.");
  }

  let lastError: Error | null = null;

  for (const sourceUrl of candidateUrls) {
    await cleanupSourceArtifacts(input.workingDir);
    const outputBase = path.join(input.workingDir, "source-media");

    try {
      await runCommand(
        env.YT_DLP_PATH,
        [
          "--no-playlist",
          "--extract-audio",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "--write-thumbnail",
          "--convert-thumbnails",
          "jpg",
          "-o",
          `${outputBase}.%(ext)s`,
          sourceUrl,
        ],
        input.workingDir,
      );

      const audioPath = await findArtifact(input.workingDir, "source-media", [".mp3"]);
      if (!audioPath || !(await fileExists(audioPath))) {
        throw new Error("yt-dlp completed without producing an MP3 audio file.");
      }

      const thumbnailPath =
        (await findArtifact(input.workingDir, "source-media", [".jpg", ".jpeg"])) ?? null;

      return {
        audioPath,
        thumbnailPath,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Unable to download source media artifacts.");
}

export async function concatClips(input: {
  clipPaths: string[];
  outputPath: string;
  workingDir: string;
}): Promise<void> {
  const env = getVideoServiceEnv();
  const manifestPath = path.join(input.workingDir, "concat.txt");
  await fs.writeFile(manifestPath, `${buildConcatManifest(input.clipPaths)}\n`, "utf8");

  await runCommand(
    env.FFMPEG_PATH,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      manifestPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      input.outputPath,
    ],
    input.workingDir,
  );
}

export async function muxVideoWithAudio(input: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
  workingDir: string;
}): Promise<void> {
  const env = getVideoServiceEnv();
  await runCommand(
    env.FFMPEG_PATH,
    [
      "-y",
      "-i",
      input.videoPath,
      "-i",
      input.audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-movflags",
      "+faststart",
      input.outputPath,
    ],
    input.workingDir,
  );
}

export async function generateThumbnail(input: {
  videoPath: string;
  outputPath: string;
  workingDir: string;
}): Promise<void> {
  const env = getVideoServiceEnv();
  await runCommand(
    env.FFMPEG_PATH,
    [
      "-y",
      "-ss",
      "1",
      "-i",
      input.videoPath,
      "-frames:v",
      "1",
      input.outputPath,
    ],
    input.workingDir,
  );
}

export async function uploadLocalFile(input: {
  localPath: string;
  storagePath: string;
  contentType: string;
}): Promise<string> {
  const bucket = getVideoServiceBucket();
  const file = bucket.file(input.storagePath);
  const data = await fs.readFile(input.localPath);
  const downloadToken = randomUUID();

  await file.save(data, {
    metadata: {
      contentType: input.contentType,
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
    resumable: false,
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    input.storagePath,
  )}?alt=media&token=${downloadToken}`;
}
