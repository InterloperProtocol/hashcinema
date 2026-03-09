import { processJob } from "./process-job";
import { createServer } from "http";

function unauthorized(response: import("http").ServerResponse) {
  response.statusCode = 401;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ error: "Unauthorized" }));
}

const port = Number(process.env.PORT ?? "8080");
const workerToken = process.env.WORKER_TOKEN;

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/") {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  if (workerToken) {
    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${workerToken}`) {
      unauthorized(response);
      return;
    }
  }

  const chunks: Buffer[] = [];
  request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  request.on("end", async () => {
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        jobId?: string;
      };
      if (!payload.jobId) {
        response.statusCode = 400;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: "Missing jobId" }));
        return;
      }

      await processJob(payload.jobId);
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ ok: true, jobId: payload.jobId }));
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Worker failure",
        }),
      );
    }
  });
});

server.listen(port, () => {
  console.log(`HASHCINEMA worker listening on ${port}`);
});
