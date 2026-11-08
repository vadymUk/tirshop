import "server-only";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Best-effort fixed-window limiter for sensitive server actions, keyed by client IP.
 * State is per server instance (in-memory), so it slows down brute force and abuse but
 * is not a global guarantee; Supabase Auth applies its own project-wide limits on top.
 */
export async function isRateLimited(action: string, limit: number, windowSeconds: number) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const key = `${action}:${ip}`;
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
