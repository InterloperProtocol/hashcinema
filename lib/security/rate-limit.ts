import { getDb } from "@/lib/firebase/admin";

const RATE_LIMIT_COLLECTION = "rate_limits";

export interface RateLimitRule {
  windowSec: number;
  limit: number;
  name: string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  exceededRule?: string;
}

function encodeKey(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function bucketStart(nowSec: number, windowSec: number): number {
  return Math.floor(nowSec / windowSec) * windowSec;
}

interface CounterSnapshot {
  count: number;
}

export async function enforceRateLimit(input: {
  scope: string;
  key: string;
  rules: RateLimitRule[];
  now?: Date;
}): Promise<RateLimitResult> {
  const db = getDb();
  const now = input.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const encodedKey = encodeKey(`${input.scope}:${input.key}`);

  return db.runTransaction(async (tx) => {
    const refs = input.rules.map((rule) => {
      const start = bucketStart(nowSec, rule.windowSec);
      const id = `${input.scope}:${rule.name}:${rule.windowSec}:${start}:${encodedKey}`;
      return {
        rule,
        start,
        ref: db.collection(RATE_LIMIT_COLLECTION).doc(id),
      };
    });

    const snapshots = await Promise.all(refs.map((entry) => tx.get(entry.ref)));
    const parsed = snapshots.map((snapshot) =>
      snapshot.exists ? (snapshot.data() as CounterSnapshot) : { count: 0 },
    );

    let retryAfterSec = 0;
    let exceededRule: string | undefined;
    for (let index = 0; index < refs.length; index += 1) {
      const entry = refs[index]!;
      const current = parsed[index]!;
      if ((current.count ?? 0) >= entry.rule.limit) {
        const remaining = entry.start + entry.rule.windowSec - nowSec;
        retryAfterSec = Math.max(retryAfterSec, Math.max(1, remaining));
        exceededRule = entry.rule.name;
      }
    }

    if (retryAfterSec > 0) {
      return {
        allowed: false,
        retryAfterSec,
        exceededRule,
      };
    }

    for (let index = 0; index < refs.length; index += 1) {
      const entry = refs[index]!;
      const current = parsed[index]!;
      tx.set(
        entry.ref,
        {
          scope: input.scope,
          key: encodedKey,
          rule: entry.rule.name,
          windowSec: entry.rule.windowSec,
          bucketStart: entry.start,
          count: (current.count ?? 0) + 1,
          updatedAt: now.toISOString(),
          expiresAt: new Date((entry.start + entry.rule.windowSec) * 1000).toISOString(),
        },
        { merge: true },
      );
    }

    return {
      allowed: true,
      retryAfterSec: 0,
    };
  });
}

