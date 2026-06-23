import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";

type RateLimitOptions = {
  blockMs: number;
  maxAttempts: number;
  windowMs: number;
};

type RateLimitBucket = {
  blockedUntil: number;
  timestamps: number[];
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __csnRateLimitStore?: Map<string, RateLimitBucket>;
};

function getMemoryStore() {
  if (!globalForRateLimit.__csnRateLimitStore) {
    globalForRateLimit.__csnRateLimitStore = new Map();
  }

  return globalForRateLimit.__csnRateLimitStore;
}

function getBucketKey(scope: string, key: string) {
  return `${scope}:${key}`;
}

function consumeMemoryRateLimit(scope: string, key: string, options: RateLimitOptions) {
  const store = getMemoryStore();
  const bucketKey = getBucketKey(scope, key);
  const now = Date.now();
  const bucket = store.get(bucketKey) ?? {
    blockedUntil: 0,
    timestamps: [],
  };

  bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < options.windowMs);

  if (bucket.blockedUntil > now) {
    store.set(bucketKey, bucket);
    return {
      allowed: false,
      retryAfterMs: bucket.blockedUntil - now,
    };
  }

  bucket.timestamps.push(now);

  if (bucket.timestamps.length > options.maxAttempts) {
    bucket.blockedUntil = now + options.blockMs;
    store.set(bucketKey, bucket);
    return {
      allowed: false,
      retryAfterMs: options.blockMs,
    };
  }

  store.set(bucketKey, bucket);
  return {
    allowed: true,
    retryAfterMs: 0,
  };
}

export async function consumeRateLimit(scope: string, key: string, options: RateLimitOptions) {
  if (isFixtureMode()) {
    return consumeMemoryRateLimit(scope, key, options);
  }

  const now = new Date();

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.rateLimitBucket.findUnique({
        where: {
          scope_key: {
            scope,
            key,
          },
        },
      });

      if (!existing) {
        await tx.rateLimitBucket.create({
          data: {
            scope,
            key,
            attemptCount: 1,
            windowStart: now,
            blockedUntil: null,
          },
        });

        return {
          allowed: true,
          retryAfterMs: 0,
        };
      }

      if (existing.blockedUntil && existing.blockedUntil > now) {
        return {
          allowed: false,
          retryAfterMs: existing.blockedUntil.getTime() - now.getTime(),
        };
      }

      const windowExpiresAt = existing.windowStart.getTime() + options.windowMs;
      const windowReset = windowExpiresAt <= now.getTime();
      const nextAttemptCount = windowReset ? 1 : existing.attemptCount + 1;
      const blockedUntil = nextAttemptCount > options.maxAttempts ? new Date(now.getTime() + options.blockMs) : null;

      await tx.rateLimitBucket.update({
        where: { id: existing.id },
        data: {
          attemptCount: nextAttemptCount,
          windowStart: windowReset ? now : existing.windowStart,
          blockedUntil,
        },
      });

      if (blockedUntil) {
        return {
          allowed: false,
          retryAfterMs: options.blockMs,
        };
      }

      return {
        allowed: true,
        retryAfterMs: 0,
      };
    });
  } catch (error) {
    console.error("[rate-limit] database rate limit unavailable, falling back to memory store", {
      scope,
      key,
      error,
    });
    return consumeMemoryRateLimit(scope, key, options);
  }
}

export async function resetRateLimit(scope: string, key: string) {
  if (isFixtureMode()) {
    getMemoryStore().delete(getBucketKey(scope, key));
    return;
  }

  try {
    await db.rateLimitBucket.deleteMany({
      where: {
        scope,
        key,
      },
    });
  } catch (error) {
    console.error("[rate-limit] failed to reset database rate limit bucket", {
      scope,
      key,
      error,
    });
    getMemoryStore().delete(getBucketKey(scope, key));
  }
}
