/**
 * In-memory sliding-window rate limiter.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   const result = limiter.check(key);  // key = IP or userId
 *   if (!result.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

interface RateLimiterOptions {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  max: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions) {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 5 * 60 * 1000);

  // Allow GC to collect the timer if the module is unloaded
  if (cleanupInterval.unref) cleanupInterval.unref();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      if (entry.timestamps.length >= max) {
        const oldest = entry.timestamps[0];
        return {
          allowed: false,
          remaining: 0,
          resetMs: oldest + windowMs - now,
        };
      }

      entry.timestamps.push(now);
      return {
        allowed: true,
        remaining: max - entry.timestamps.length,
        resetMs: windowMs,
      };
    },
  };
}

// ─── Pre-configured limiters ───

/** Auth endpoints (login, register, forgot-password): 10 req / minute per IP */
export const authLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** Extension token endpoint: 10 req / minute per IP */
export const extensionAuthLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** Compliance check endpoints: 30 req / minute per user */
export const checkLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/** Bulk upload: 5 req / minute per user */
export const bulkLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/** General API: 60 req / minute per user */
export const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

/** Extract a rate-limit key from request (IP-based). */
export function getIpKey(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
