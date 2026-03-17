import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import { buildFallbackReportSummary } from "../lib/ai/report";
import { getDb } from "../lib/firebase/admin";
import { ReportDocument } from "../lib/types/domain";

const BANNED_PHRASES = [
  "this was posted by insomnia, not strategy.",
  "from a wellness perspective, this was not a cooldown. this was a sequel.",
  "you had to be in the trenches chat to process this one.",
  "with a live audience and no shame filter.",
];

const BANNED_SUBSTRINGS = [
  "trenches chat",
  "no shame filter",
  "cooldown. this was a sequel",
  "posted by insomnia",
];

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function isBanned(text: string): boolean {
  const cleaned = normalize(text);
  if (!cleaned) return true;
  if (BANNED_PHRASES.includes(cleaned)) return true;
  return BANNED_SUBSTRINGS.some((fragment) => cleaned.includes(fragment));
}

function cleanLines(lines: string[] | undefined, maxCount: number): string[] {
  if (!lines?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isBanned(trimmed)) continue;
    const key = normalize(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= maxCount) break;
  }

  return result;
}

function mergeFallback(
  primary: string[],
  fallback: string[] | undefined,
  maxCount: number,
): string[] {
  if (primary.length >= maxCount) return primary.slice(0, maxCount);
  const result = [...primary];
  const seen = new Set(primary.map(normalize));
  for (const line of fallback ?? []) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isBanned(trimmed)) continue;
    const key = normalize(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= maxCount) break;
  }
  return result;
}

function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!key || key in process.env) continue;
    const cleaned = value.replace(/^['"]|['"]$/g, "");
    process.env[key] = cleaned;
  }

  if (!process.env.PAYMENT_MASTER_SEED_HEX) {
    process.env.PAYMENT_MASTER_SEED_HEX = "0".repeat(64);
  }
}

async function main() {
  loadEnvFile();
  const db = getDb();
  const snapshot = await db
    .collection("jobs")
    .where("status", "==", "complete")
    .get();

  if (snapshot.empty) {
    console.log("No completed jobs found.");
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const jobDoc of snapshot.docs) {
    const jobId = jobDoc.id;
    const reportRef = db.collection("reports").doc(jobId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
      skipped += 1;
      continue;
    }

    const report = reportSnap.data() as ReportDocument;

    const funObservations = mergeFallback(
      cleanLines(report.funObservations, 4),
      report.memorableMoments,
      4,
    );
    const memorableMoments = cleanLines(report.memorableMoments, 4);
    const behaviorPatterns = cleanLines(report.behaviorPatterns, 4);
    const storyBeats = cleanLines(report.storyBeats, 5);

    const { summary: _summary, downloadUrl: _downloadUrl, ...summaryInput } = report;
    const summary = buildFallbackReportSummary(summaryInput);

    const patch: Partial<ReportDocument> = {
      summary,
      funObservations,
      memorableMoments,
      behaviorPatterns,
      storyBeats,
    };

    await reportRef.set(patch, { merge: true });
    updated += 1;
  }

  console.log(`Updated ${updated} reports. Skipped ${skipped}.`);
}

main().catch((error) => {
  console.error("Failed to update dossiers:", error);
  process.exit(1);
});
