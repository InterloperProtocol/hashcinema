import { getEnv } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/network/http";
import {
  isRetryableHttpStatus,
  RetryableError,
  withRetry,
} from "@/lib/network/retry";

export interface OpenRouterMessage {
  role: "system" | "user";
  content: string;
}

interface OpenRouterChoice {
  message?: {
    content?: string | null;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
}

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }

  throw new Error("No JSON object found in model response");
}

export async function openRouterChat(params: {
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const env = getEnv();
  const payload = await withRetry(
    async () => {
      const response = await fetchWithTimeout(
        `${env.OPENROUTER_BASE_URL}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            ...(env.OPENROUTER_SITE_URL
              ? { "HTTP-Referer": env.OPENROUTER_SITE_URL }
              : {}),
            "X-Title": env.OPENROUTER_APP_NAME,
          },
          body: JSON.stringify({
            model: "mistralai/mistral-small",
            messages: params.messages,
            temperature: params.temperature ?? 0.2,
            max_tokens: params.maxTokens ?? 1200,
          }),
        },
        18_000,
      );

      if (!response.ok) {
        const body = await response.text();
        const message = `OpenRouter request failed (${response.status}): ${body}`;
        if (isRetryableHttpStatus(response.status)) {
          throw new RetryableError(message);
        }
        throw new Error(message);
      }

      return (await response.json()) as OpenRouterResponse;
    },
    {
      attempts: 3,
      baseDelayMs: 700,
      maxDelayMs: 4_000,
    },
  );

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter returned empty response content");
  }
  return content;
}

export async function openRouterJson<T>(params: {
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const content = await openRouterChat(params);
  const jsonText = extractJson(content);
  return JSON.parse(jsonText) as T;
}
