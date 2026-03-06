import { Redis } from "@upstash/redis";
import crypto from "crypto";
import type { AdContentPayload } from "@/lib/ai/runComplianceCheck";

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis)
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  return redis;
}

export function buildCacheKey(payload: {
  adContent: AdContentPayload;
  platformIds: string[];
  categoryIds: string[];
  countryIds: string[];
  rulesSnapshot: string;
}): string {
  const canonical = JSON.stringify({
    ...payload,
    platformIds: [...payload.platformIds].sort(),
    categoryIds: [...payload.categoryIds].sort(),
    countryIds: [...payload.countryIds].sort(),
  });
  return "acp:check:" + crypto.createHash("sha256").update(canonical).digest("hex");
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  try {
    return await getRedis().get<T>(key);
  } catch {
    return null;
  }
}

export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds = 86400
): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return;
  try {
    await getRedis().set(key, value, { ex: ttlSeconds });
  } catch {
    /* non-fatal */
  }
}
