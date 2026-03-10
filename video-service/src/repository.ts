import { getVideoServiceDb } from "./firebase";
import { NormalizedRenderRequest, RenderJobRecord, RenderStatus } from "./types";

const COLLECTION = "video_renders";

function nowIso(): string {
  return new Date().toISOString();
}

function collection() {
  return getVideoServiceDb().collection(COLLECTION);
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalize(record: RenderJobRecord): RenderJobRecord {
  return {
    ...record,
    status: (record.status ?? record.renderStatus ?? "queued") as RenderStatus,
    renderStatus: (record.renderStatus ?? record.status ?? "queued") as RenderStatus,
    startedAt: record.startedAt ?? null,
    completedAt: record.completedAt ?? null,
    videoUrl: record.videoUrl ?? null,
    thumbnailUrl: record.thumbnailUrl ?? null,
    error: record.error ?? null,
  };
}

export async function getRenderJob(id: string): Promise<RenderJobRecord | null> {
  const doc = await collection().doc(id).get();
  if (!doc.exists) return null;
  return normalize(doc.data() as RenderJobRecord);
}

export async function createOrGetRenderJob(
  jobId: string,
  request: NormalizedRenderRequest,
): Promise<{ record: RenderJobRecord; created: boolean }> {
  const sanitizedRequest = stripUndefined(request);

  return getVideoServiceDb().runTransaction(async (tx) => {
    const ref = collection().doc(jobId);
    const snap = await tx.get(ref);
    if (snap.exists) {
      return {
        record: normalize(snap.data() as RenderJobRecord),
        created: false,
      };
    }

    const createdAt = nowIso();
    const record: RenderJobRecord = {
      id: jobId,
      jobId,
      status: "queued",
      renderStatus: "queued",
      videoUrl: null,
      thumbnailUrl: null,
      error: null,
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      completedAt: null,
      request: sanitizedRequest,
    };

    tx.set(ref, record);
    return { record, created: true };
  });
}

export async function updateRenderJob(
  id: string,
  patch: Partial<Omit<RenderJobRecord, "id" | "jobId" | "createdAt">>,
): Promise<void> {
  await collection()
    .doc(id)
    .set(
      {
        ...patch,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
}

export async function markRenderProcessing(id: string): Promise<void> {
  await updateRenderJob(id, {
    status: "processing",
    renderStatus: "processing",
    startedAt: nowIso(),
    error: null,
  });
}

export async function markRenderReady(
  id: string,
  result: { videoUrl: string; thumbnailUrl: string | null },
): Promise<void> {
  await updateRenderJob(id, {
    status: "ready",
    renderStatus: "ready",
    videoUrl: result.videoUrl,
    thumbnailUrl: result.thumbnailUrl,
    completedAt: nowIso(),
    error: null,
  });
}

export async function markRenderFailed(id: string, error: string): Promise<void> {
  await updateRenderJob(id, {
    status: "failed",
    renderStatus: "failed",
    error,
    completedAt: nowIso(),
  });
}
