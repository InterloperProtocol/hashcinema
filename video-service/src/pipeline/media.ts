import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { Storage } from "@google-cloud/storage";
import { getVideoServiceBucket } from "../firebase";
import { getVideoServiceEnv } from "../env";

const LONG_LIVED_EXPIRY = "03-01-2500";

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

function parseGcsUri(uri: string): { bucket: string; objectPath: string } {
  const match = uri.match(/^gcs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid gcs uri: ${uri}`);
  }
  return {
    bucket: match[1]!,
    objectPath: match[2]!,
  };
}

async function downloadFromUri(uri: string, destination: string): Promise<void> {
  if (uri.startsWith("gcs://")) {
    const storage = new Storage();
    const { bucket, objectPath } = parseGcsUri(uri);
    await storage.bucket(bucket).file(objectPath).download({ destination });
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

  await file.save(data, {
    metadata: {
      contentType: input.contentType,
      cacheControl: "public,max-age=31536000,immutable",
    },
    resumable: false,
  });

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: LONG_LIVED_EXPIRY,
  });

  return signedUrl;
}
