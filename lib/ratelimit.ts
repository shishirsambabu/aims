// Minimal in-memory sliding-window rate limiter. Per-process (best-effort on
// serverless), enough to blunt accidental floods / abuse of expensive routes.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateResult {
  ok: boolean;
  retryAfter: number; // seconds
}

/**
 * @param key   unique key (e.g. `import:${userId}`)
 * @param limit max requests per window
 * @param windowMs window length in ms
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

function redisKey(key: string): string {
  return `aims:ratelimit:${key.replace(/[^a-zA-Z0-9:_-]/g, "_")}`;
}

async function upstashCommand<T>(command: string, ...args: Array<string | number>): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("UPSTASH_NOT_CONFIGURED");

  const endpoint = [url.replace(/\/$/, ""), command, ...args.map((arg) => encodeURIComponent(String(arg)))].join("/");
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`UPSTASH_RATE_LIMIT_FAILED_${response.status}`);
  const body = (await response.json()) as { result: T };
  return body.result;
}

/**
 * Production-safe rate limiter. Uses Upstash Redis when configured and falls
 * back to the in-memory limiter for local development.
 */
export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return rateLimit(key, limit, windowMs);
  }

  try {
    const namespacedKey = redisKey(key);
    const count = Number(await upstashCommand<number>("incr", namespacedKey));
    if (count === 1) {
      await upstashCommand<number>("pexpire", namespacedKey, windowMs);
    }
    if (count > limit) {
      const ttlMs = Number(await upstashCommand<number>("pttl", namespacedKey));
      return { ok: false, retryAfter: Math.max(1, Math.ceil(ttlMs / 1000)) };
    }
    return { ok: true, retryAfter: 0 };
  } catch {
    return rateLimit(key, limit, windowMs);
  }
}
