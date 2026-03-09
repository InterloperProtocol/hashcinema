const store = new Map<string, Record<string, unknown>>();

const fakeDb = {
  collection: () => ({
    doc: (id: string) => ({ id }),
  }),
  runTransaction: async <T>(
    fn: (tx: {
      get: (ref: { id: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      set: (
        ref: { id: string },
        value: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => void;
    }) => Promise<T>,
  ) => {
    const tx = {
      get: async (ref: { id: string }) => ({
        exists: store.has(ref.id),
        data: () => store.get(ref.id),
      }),
      set: (
        ref: { id: string },
        value: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => {
        if (options?.merge && store.has(ref.id)) {
          store.set(ref.id, { ...store.get(ref.id), ...value });
          return;
        }
        store.set(ref.id, value);
      },
    };

    return fn(tx);
  },
};

vi.mock("@/lib/firebase/admin", () => ({
  getDb: () => fakeDb,
}));

import { enforceRateLimit } from "@/lib/security/rate-limit";

describe("Firestore-backed rate limiter", () => {
  beforeEach(() => {
    store.clear();
  });

  it("enforces thresholds and resets in a new window", async () => {
    const rules = [{ name: "per_minute", windowSec: 60, limit: 2 }];
    const first = await enforceRateLimit({
      scope: "api_jobs_post",
      key: "1.2.3.4:wallet",
      rules,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const second = await enforceRateLimit({
      scope: "api_jobs_post",
      key: "1.2.3.4:wallet",
      rules,
      now: new Date("2026-01-01T00:00:10.000Z"),
    });
    const third = await enforceRateLimit({
      scope: "api_jobs_post",
      key: "1.2.3.4:wallet",
      rules,
      now: new Date("2026-01-01T00:00:20.000Z"),
    });
    const nextWindow = await enforceRateLimit({
      scope: "api_jobs_post",
      key: "1.2.3.4:wallet",
      rules,
      now: new Date("2026-01-01T00:01:01.000Z"),
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
    expect(nextWindow.allowed).toBe(true);
  });
});

