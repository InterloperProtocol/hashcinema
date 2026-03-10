import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { getVideoServiceEnv } from "./env";
import { parseRenderRequest } from "./types";
import { RenderService } from "./render-service";

export interface RenderServicePort {
  startOrGet(request: ReturnType<typeof parseRenderRequest>): Promise<
    | {
        mode: "sync";
        id: string;
        jobId: string;
        videoUrl: string;
        thumbnailUrl: string | null;
      }
    | {
        mode: "async";
        id: string;
        jobId: string;
      }
  >;
  getById(id: string): Promise<{
    id: string;
    status: string;
    renderStatus: string;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    error: string | null;
  } | null>;
}

function unauthorized(reply: FastifyReply): FastifyReply {
  return reply.status(401).send({ error: "Unauthorized" });
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  return header.trim();
}

function buildStatusUrl(request: FastifyRequest, renderId: string, configuredBase?: string): string {
  if (configuredBase) {
    return `${configuredBase.replace(/\/+$/, "")}/render/${renderId}`;
  }
  const protoHeader = request.headers["x-forwarded-proto"];
  const protocol =
    typeof protoHeader === "string" ? protoHeader.split(",")[0]!.trim() : request.protocol;
  const host = request.headers.host;
  return `${protocol}://${host}/render/${renderId}`;
}

export function buildVideoService(input?: {
  service?: RenderServicePort;
  authToken?: string;
  baseUrl?: string;
}): FastifyInstance {
  let cachedEnv: ReturnType<typeof getVideoServiceEnv> | null = null;
  const env = () => {
    if (!cachedEnv) {
      cachedEnv = getVideoServiceEnv();
    }
    return cachedEnv;
  };

  const service = input?.service ?? new RenderService();
  const authToken = input?.authToken ?? env().VIDEO_API_KEY;
  const configuredBase = input?.baseUrl ?? env().VIDEO_SERVICE_BASE_URL;

  const app = Fastify({
    logger: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    const token = extractBearer(request.headers.authorization);
    if (token !== authToken) {
      return unauthorized(reply);
    }
  });

  app.post("/render", async (request, reply) => {
    try {
      const payload = parseRenderRequest(request.body);
      const result = await service.startOrGet(payload);

      if (result.mode === "sync") {
        return reply.send({
          videoUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl,
        });
      }

      return reply.send({
        id: result.id,
        jobId: result.jobId,
        statusUrl: buildStatusUrl(request, result.id, configuredBase),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: "Invalid payload",
          details: error.issues,
        });
      }

      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(500).send({ error: "Unknown server error" });
    }
  });

  const getRenderStatus = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const record = await service.getById(request.params.id);
    if (!record) {
      return reply.status(404).send({ error: "Render not found" });
    }

    return reply.send({
      status: record.status,
      renderStatus: record.renderStatus,
      videoUrl: record.videoUrl,
      thumbnailUrl: record.thumbnailUrl,
      error: record.error,
    });
  };

  app.get("/render/:id", getRenderStatus);
  app.get("/render/status/:id", getRenderStatus);

  return app;
}

async function start() {
  const env = getVideoServiceEnv();
  const app = buildVideoService();
  await app.listen({
    host: "0.0.0.0",
    port: env.PORT,
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
