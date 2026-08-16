import { redis } from "../config/redis";
import { logger } from "./logger";

const DEFAULT_TTL_SECONDS = 60 * 5; // 5 minutes

/**
 * Cache-aside helper.
 * Tries redis first; on a miss, runs `fetcher`, stores the result, then returns it.
 * This is the "cache layer" required by the brief so we don't always hit the DB.
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    logger.error(`Cache read failed for key ${key}: ${(err as Error).message}`);
  }

  const fresh = await fetcher();

  try {
    await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
  } catch (err) {
    logger.error(`Cache write failed for key ${key}: ${(err as Error).message}`);
  }

  return fresh;
}

/** Invalidate a single key or all keys matching a prefix (used after writes). */
export async function invalidateCache(pattern: string): Promise<void> {
  if (!pattern.includes("*")) {
    await redis.del(pattern);
    return;
  }
  const keys = await redis.keys(pattern);
  if (keys.length) {
    await redis.del(...keys);
  }
}
