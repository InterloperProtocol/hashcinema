import { setTimeout as sleep } from "timers/promises";
import { GoogleAuth } from "google-auth-library";
import { getVideoServiceEnv } from "../env";

interface VertexStartResponse {
  name?: string;
}

interface VertexOperationResponse {
  name?: string;
  done?: boolean;
  error?: {
    message?: string;
    code?: number;
  };
  response?: unknown;
}

export interface GenerateClipInput {
  model: string;
  prompt: string;
  durationSeconds: number;
  imageUrl?: string | null;
  styleHints?: string[];
}

function findVideoUris(value: unknown, collector: Set<string>): void {
  if (typeof value === "string") {
    if (
      value.startsWith("gcs://") ||
      value.startsWith("https://") ||
      value.startsWith("http://")
    ) {
      collector.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      findVideoUris(item, collector);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const map = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(map)) {
    if (
      key.toLowerCase().includes("uri") ||
      key.toLowerCase().includes("url") ||
      key.toLowerCase().includes("video")
    ) {
      findVideoUris(item, collector);
      continue;
    }
    findVideoUris(item, collector);
  }
}

export function extractVideoUrisFromOperation(operation: VertexOperationResponse): string[] {
  const uris = new Set<string>();
  findVideoUris(operation.response, uris);
  return [...uris];
}

export class VertexVeoClient {
  private readonly auth: GoogleAuth;

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }

  private async getAuthHeader(): Promise<string> {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) {
      throw new Error("Unable to acquire Google Cloud access token for Veo.");
    }
    return `Bearer ${token.token}`;
  }

  private buildPredictEndpoint(input: { projectId: string; location: string; model: string }): string {
    return `https://${input.location}-aiplatform.googleapis.com/v1/projects/${input.projectId}/locations/${input.location}/publishers/google/models/${input.model}:predictLongRunning`;
  }

  private buildOperationEndpoint(input: { location: string; operationName: string }): string {
    if (input.operationName.startsWith("https://")) {
      return input.operationName;
    }
    return `https://${input.location}-aiplatform.googleapis.com/v1/${input.operationName}`;
  }

  async generateClip(input: GenerateClipInput): Promise<{ operationName: string; videoUris: string[] }> {
    const env = getVideoServiceEnv();
    const authHeader = await this.getAuthHeader();

    const endpoint = this.buildPredictEndpoint({
      projectId: env.VERTEX_PROJECT_ID,
      location: env.VERTEX_LOCATION,
      model: input.model,
    });

    const requestBody: Record<string, unknown> = {
      instances: [
        {
          prompt: input.prompt,
          ...(input.imageUrl ? { image: { uri: input.imageUrl } } : {}),
        },
      ],
      parameters: {
        durationSeconds: input.durationSeconds,
        ...(input.styleHints?.length ? { styleHints: input.styleHints } : {}),
      },
    };

    const startResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!startResponse.ok) {
      const body = await startResponse.text();
      throw new Error(`Veo start failed (${startResponse.status}): ${body}`);
    }

    const started = (await startResponse.json()) as VertexStartResponse;
    if (!started.name) {
      throw new Error("Veo did not return an operation name.");
    }

    const operationEndpoint = this.buildOperationEndpoint({
      location: env.VERTEX_LOCATION,
      operationName: started.name,
    });

    for (let attempt = 0; attempt < env.VERTEX_MAX_POLL_ATTEMPTS; attempt += 1) {
      await sleep(env.VERTEX_POLL_INTERVAL_MS);

      const operationResponse = await fetch(operationEndpoint, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (!operationResponse.ok) {
        const body = await operationResponse.text();
        throw new Error(`Veo operation polling failed (${operationResponse.status}): ${body}`);
      }

      const operation = (await operationResponse.json()) as VertexOperationResponse;
      if (!operation.done) {
        continue;
      }

      if (operation.error) {
        throw new Error(operation.error.message ?? "Veo operation failed.");
      }

      const videoUris = extractVideoUrisFromOperation(operation);
      if (!videoUris.length) {
        throw new Error("Veo operation completed without any video URI.");
      }

      return {
        operationName: started.name,
        videoUris,
      };
    }

    throw new Error("Timed out while waiting for Veo operation completion.");
  }
}
