import { openRouterJson } from "@/lib/ai/openrouter";
import { ReportDocument } from "@/lib/types/domain";

interface SummaryResponse {
  summary: string;
}

export async function generateReportSummary(
  report: Omit<ReportDocument, "summary" | "downloadUrl">,
): Promise<string> {
  const response = await openRouterJson<SummaryResponse>({
    temperature: 0.1,
    maxTokens: 400,
    messages: [
      {
        role: "system",
        content:
          "You are a trading analyst. Use ONLY the JSON facts provided. Do not invent any trades, tokens, timestamps, or prices. Output strictly JSON with one key: summary.",
      },
      {
        role: "user",
        content: `Generate a concise report summary (80-140 words) from these facts:\n${JSON.stringify(
          report,
        )}`,
      },
    ],
  });

  return response.summary?.trim() || "No summary available.";
}
