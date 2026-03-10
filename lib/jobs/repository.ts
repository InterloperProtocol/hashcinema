import { PACKAGE_CONFIG } from "@/lib/constants";
import { getDb } from "@/lib/firebase/admin";
import { assertTransition } from "@/lib/jobs/state-machine";
import { applyPaymentSettlement } from "@/lib/payments/settlement";
import { solToLamports } from "@/lib/payments/solana-pay";
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

function normalizeJobDocument(raw: JobDocument): JobDocument {
  return {
    ...raw,
    requiredLamports: raw.requiredLamports ?? solToLamports(raw.priceSol),
    receivedLamports: raw.receivedLamports ?? 0,
    paymentSignatures: Array.isArray(raw.paymentSignatures)
      ? raw.paymentSignatures
      : [],
    lastPaymentAt: raw.lastPaymentAt ?? null,
  };
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
    requiredLamports: solToLamports(pkg.priceSol),
    receivedLamports: 0,
    paymentSignatures: [],
    lastPaymentAt: null,
  };

  await jobsCollection().doc(jobId).set(job);
  return job;
}

export async function getJob(jobId: string): Promise<JobDocument | null> {
  const doc = await jobsCollection().doc(jobId).get();
  if (!doc.exists) {
    return null;
  }
  return normalizeJobDocument(doc.data() as JobDocument);
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

    const current = normalizeJobDocument(snap.data() as JobDocument);
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
      lastPaymentAt: nowIso(),
    });
    return;
  }

  if (job.status === "payment_detected" && !job.txSignature) {
    await updateJob(jobId, {
      txSignature,
      progress: "payment_detected",
      lastPaymentAt: nowIso(),
    });
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
      lastPaymentAt: nowIso(),
    });
    await updateJobStatus(jobId, "payment_confirmed", {
      txSignature,
      progress: "payment_confirmed",
      lastPaymentAt: nowIso(),
    });
    return;
  }

  if (job.status === "payment_detected") {
    await updateJobStatus(jobId, "payment_confirmed", {
      txSignature,
      progress: "payment_confirmed",
      lastPaymentAt: nowIso(),
    });
  }
}

export async function applyConfirmedPayment(input: {
  jobId: string;
  signature: string;
  lamports: number;
}): Promise<{
  job: JobDocument | null;
  duplicate: boolean;
  newlyConfirmed: boolean;
}> {
  return getDb().runTransaction(async (tx) => {
    const ref = jobsCollection().doc(input.jobId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return {
        job: null,
        duplicate: false,
        newlyConfirmed: false,
      };
    }

    const current = normalizeJobDocument(snap.data() as JobDocument);
    const settlement = applyPaymentSettlement(
      {
        status: current.status,
        requiredLamports: current.requiredLamports,
        receivedLamports: current.receivedLamports,
        paymentSignatures: current.paymentSignatures,
        txSignature: current.txSignature,
      },
      {
        signature: input.signature,
        lamports: input.lamports,
      },
    );

    if (settlement.duplicate) {
      return {
        job: current,
        duplicate: true,
        newlyConfirmed: false,
      };
    }

    if (current.status !== settlement.next.status) {
      assertTransition(current.status, settlement.next.status);
    }

    const nextProgress: JobProgress =
      settlement.next.status === "payment_confirmed"
        ? "payment_confirmed"
        : settlement.next.status === "payment_detected"
          ? "payment_detected"
          : current.progress;

    const updated: JobDocument = {
      ...current,
      status: settlement.next.status,
      progress: nextProgress,
      txSignature: settlement.next.txSignature,
      requiredLamports: settlement.next.requiredLamports,
      receivedLamports: settlement.next.receivedLamports,
      paymentSignatures: settlement.next.paymentSignatures,
      lastPaymentAt: nowIso(),
      errorCode: null,
      errorMessage: null,
      updatedAt: nowIso(),
    };

    tx.set(ref, updated, { merge: true });

    return {
      job: updated,
      duplicate: false,
      newlyConfirmed: settlement.newlyConfirmed,
    };
  });
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
