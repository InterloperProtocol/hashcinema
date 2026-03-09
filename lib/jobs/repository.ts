import { PACKAGE_CONFIG } from "@/lib/constants";
import { getDb } from "@/lib/firebase/admin";
import { assertTransition } from "@/lib/jobs/state-machine";
import {
  JobDocument,
  JobProgress,
  JobStatus,
  PackageType,
  PumpMetadataCacheDocument,
  ReportDocument,
  VideoDocument,
} from "@/lib/types/domain";
import { randomUUID } from "crypto";

function nowIso(): string {
  return new Date().toISOString();
}

function jobsCollection() {
  return getDb().collection("jobs");
}

function reportsCollection() {
  return getDb().collection("reports");
}

function videosCollection() {
  return getDb().collection("videos");
}

function metadataCollection() {
  return getDb().collection("pump_metadata_cache");
}

export async function createJob(input: {
  wallet: string;
  packageType: PackageType;
}): Promise<JobDocument> {
  const pkg = PACKAGE_CONFIG[input.packageType];
  const createdAt = nowIso();
  const jobId = randomUUID();

  const job: JobDocument = {
    jobId,
    wallet: input.wallet,
    packageType: pkg.packageType,
    rangeDays: pkg.rangeDays,
    priceSol: pkg.priceSol,
    videoSeconds: pkg.videoSeconds,
    status: "awaiting_payment",
    progress: "awaiting_payment",
    txSignature: null,
    createdAt,
    updatedAt: createdAt,
    errorCode: null,
    errorMessage: null,
  };

  await jobsCollection().doc(jobId).set(job);
  return job;
}

export async function getJob(jobId: string): Promise<JobDocument | null> {
  const doc = await jobsCollection().doc(jobId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as JobDocument;
}

export async function getReport(jobId: string): Promise<ReportDocument | null> {
  const doc = await reportsCollection().doc(jobId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as ReportDocument;
}

export async function getVideo(jobId: string): Promise<VideoDocument | null> {
  const doc = await videosCollection().doc(jobId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as VideoDocument;
}

export async function getJobArtifacts(jobId: string): Promise<{
  job: JobDocument | null;
  report: ReportDocument | null;
  video: VideoDocument | null;
}> {
  const [job, report, video] = await Promise.all([
    getJob(jobId),
    getReport(jobId),
    getVideo(jobId),
  ]);
  return { job, report, video };
}

export async function updateJob(
  jobId: string,
  patch: Partial<Omit<JobDocument, "jobId" | "createdAt">>,
): Promise<void> {
  await jobsCollection()
    .doc(jobId)
    .set(
      {
        ...patch,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
}

export async function updateJobStatus(
  jobId: string,
  nextStatus: JobStatus,
  patch?: Partial<Omit<JobDocument, "jobId" | "status" | "createdAt">>,
): Promise<JobDocument> {
  return getDb().runTransaction(async (tx) => {
    const ref = jobsCollection().doc(jobId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`Job ${jobId} not found`);
    }

    const current = snap.data() as JobDocument;
    if (current.status !== nextStatus) {
      assertTransition(current.status, nextStatus);
    }

    const updated: JobDocument = {
      ...current,
      ...patch,
      status: nextStatus,
      progress:
        patch?.progress ??
        (nextStatus === "processing" ? "fetching_transactions" : nextStatus),
      updatedAt: nowIso(),
      jobId,
    };

    tx.set(ref, updated, { merge: true });
    return updated;
  });
}

export async function updateJobProgress(
  jobId: string,
  progress: JobProgress,
): Promise<void> {
  await updateJob(jobId, { progress });
}

export async function markPaymentDetected(
  jobId: string,
  txSignature: string,
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  if (job.status === "awaiting_payment") {
    await updateJobStatus(jobId, "payment_detected", {
      txSignature,
      progress: "payment_detected",
    });
    return;
  }

  if (job.status === "payment_detected" && !job.txSignature) {
    await updateJob(jobId, { txSignature, progress: "payment_detected" });
  }
}

export async function markPaymentConfirmed(
  jobId: string,
  txSignature: string,
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  if (job.status === "payment_confirmed" || job.status === "processing") {
    return;
  }

  if (job.status === "awaiting_payment") {
    await updateJobStatus(jobId, "payment_detected", {
      txSignature,
      progress: "payment_detected",
    });
    await updateJobStatus(jobId, "payment_confirmed", {
      txSignature,
      progress: "payment_confirmed",
    });
    return;
  }

  if (job.status === "payment_detected") {
    await updateJobStatus(jobId, "payment_confirmed", {
      txSignature,
      progress: "payment_confirmed",
    });
  }
}

export async function markJobFailed(
  jobId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  if (job.status === "failed") {
    await updateJob(jobId, { errorCode, errorMessage, progress: "failed" });
    return;
  }

  if (job.status === "complete") {
    throw new Error(`Cannot mark completed job ${jobId} as failed`);
  }

  await updateJobStatus(jobId, "failed", {
    errorCode,
    errorMessage,
    progress: "failed",
  });
}

export async function upsertReport(report: ReportDocument): Promise<void> {
  await reportsCollection().doc(report.jobId).set(report, { merge: true });
}

export async function upsertVideo(video: VideoDocument): Promise<void> {
  await videosCollection().doc(video.jobId).set(video, { merge: true });
}

export async function getPumpMetadata(
  mint: string,
): Promise<PumpMetadataCacheDocument | null> {
  const doc = await metadataCollection().doc(mint).get();
  if (!doc.exists) return null;
  return doc.data() as PumpMetadataCacheDocument;
}

export async function upsertPumpMetadata(
  metadata: PumpMetadataCacheDocument,
): Promise<void> {
  await metadataCollection().doc(metadata.mint).set(metadata, { merge: true });
}
