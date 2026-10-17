import "dotenv/config";
import Redis, { RedisOptions } from "ioredis";

// ============================================================================
// In-Memory Fallback Cache for local development and offline resilience
// ============================================================================
interface MemoryCacheItem {
  value: string;
  expiresAt: number | null;
}

class InMemoryCache {
  private store = new Map<string, MemoryCacheItem>();

  get(key: string): string | null {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt !== null && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: string, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  delete(...keys: string[]): number {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
    }
    return deleted;
  }

  deletePattern(pattern: string): number {
    // Escape regex characters except '*'
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const regex = new RegExp("^" + escaped + "$");
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  flush(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

const memoryFallback = new InMemoryCache();

// ============================================================================
// Redis Client Initialization
// ============================================================================
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_TLS_URL || "redis://127.0.0.1:6379";
const REDIS_ENABLED = process.env.REDIS_CACHE_ENABLED !== "false" && process.env.REDIS_CACHE_ENABLED !== "disabled";

let redisClient: Redis | null = null;
let hasReportedOffline = false;

if (REDIS_ENABLED) {
  const isLocalRedis = REDIS_URL.includes("127.0.0.1") || REDIS_URL.includes("localhost");

  const options: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy(times) {
      if (isLocalRedis || times >= 2) {
        return null; // Stop retrying immediately to prevent socket reconnect loops
      }
      return 500;
    },
  };

  try {
    const client = new Redis(REDIS_URL, options);

    client.on("connect", () => {
      hasReportedOffline = false;
    });

    client.on("ready", () => {
      console.log(`[Redis] Connected successfully to ${REDIS_URL.replace(/:[^:@]*@/, ":***@")}`);
    });

    client.on("error", (err: any) => {
      // Suppress repeated connection logs once offline state is recorded
      if (!hasReportedOffline) {
        if (isLocalRedis) {
          console.log("[Redis] Local Redis not detected (127.0.0.1:6379). Seamlessly using in-memory high-speed cache.");
        } else {
          console.warn(`[Redis] Connection notice: ${err?.message || "unreachable"}. Operating in in-memory mode.`);
        }
        hasReportedOffline = true;
      }
    });

    // Attempt initial connection asynchronously without blocking startup
    client.connect().catch(() => {
      if (!hasReportedOffline) {
        if (isLocalRedis) {
          console.log("[Redis] Local Redis not detected (127.0.0.1:6379). Seamlessly using in-memory high-speed cache.");
        } else {
          console.warn(`[Redis] Remote cache unreachable at ${REDIS_URL.replace(/:[^:@]*@/, ":***@")}. Using in-memory fallback.`);
        }
        hasReportedOffline = true;
      }
    });

    redisClient = client;
  } catch (error: any) {
    console.log(`[Redis] Operating with in-memory fallback cache.`);
    redisClient = null;
  }
} else {
  console.log("[Redis] Caching disabled or set to in-memory mode. Using fast in-memory store.");
}

// ============================================================================
// Cache Operations (Seamlessly uses Redis or In-Memory Fallback)
// ============================================================================

/**
 * Retrieve cached item by key
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  if (redisClient && redisClient.status === "ready") {
    try {
      const data = await redisClient.get(key);
      if (data) {
        try {
          return JSON.parse(data) as T;
        } catch {
          return null;
        }
      }
      return null;
    } catch {
      // Redis get failed, seamlessly fallback to memory store
    }
  }

  const raw = memoryFallback.get(key);
  if (raw) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Store item in cache with TTL in seconds
 */
export async function setCache(
  key: string,
  value: any,
  ttlSeconds = 60
): Promise<boolean> {
  let serialized: string;
  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    // Un-serializable payload (e.g. circular structure or BigInt)
    return false;
  }

  // Always keep in memory fallback for instant hit
  memoryFallback.set(key, serialized, ttlSeconds);

  if (redisClient && redisClient.status === "ready") {
    try {
      if (ttlSeconds > 0) {
        await redisClient.set(key, serialized, "EX", ttlSeconds);
      } else {
        await redisClient.set(key, serialized);
      }
      return true;
    } catch {
      // Redis set failed, memory fallback already stored
    }
  }

  return true;
}

/**
 * Delete one or multiple cache keys
 */
export async function deleteCache(...keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;

  const count = memoryFallback.delete(...keys);

  if (redisClient && redisClient.status === "ready") {
    try {
      const redisCount = await redisClient.del(...keys);
      return Math.max(count, redisCount);
    } catch {
      // Ignore Redis errors
    }
  }

  return count;
}

/**
 * Delete all keys matching a glob pattern (e.g. "worksphere:companies:*")
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  let count = memoryFallback.deletePattern(pattern);

  if (redisClient && redisClient.status === "ready") {
    try {
      const stream = redisClient.scanStream({
        match: pattern,
        count: 100,
      });

      const keysToDelete: string[] = [];
      for await (const chunk of stream) {
        if (chunk && chunk.length > 0) {
          keysToDelete.push(...chunk);
        }
      }

      if (keysToDelete.length > 0) {
        let redisDeleted = 0;
        // Batch in groups of 100 to prevent call stack overflow
        for (let i = 0; i < keysToDelete.length; i += 100) {
          const batch = keysToDelete.slice(i, i + 100);
          redisDeleted += await redisClient.del(...batch);
        }
        count = Math.max(count, redisDeleted);
      }
    } catch {
      // Ignore Redis errors
    }
  }

  return count;
}

/**
 * Fetch from cache or compute and cache
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60
): Promise<T> {
  try {
    const cached = await getCache<T>(key);
    if (cached !== null) {
      return cached;
    }
  } catch {
    // Cache read failed, proceed to fetch fresh data
  }

  const freshData = await fetcher();

  try {
    await setCache(key, freshData, ttlSeconds);
  } catch {
    // Cache write failed, continue returning fresh data
  }

  return freshData;
}

/**
 * Invalidate a whole category of cached keys
 */
export async function invalidateCacheCategory(
  category:
    | "dashboard"
    | "companies"
    | "subscriptions"
    | "plans"
    | "payments"
    | "promotions"
    | "tickets"
    | "announcements"
    | "admin_users"
    | "roles"
    | "settings"
    | "audit"
    | "all"
    | (string & {})
): Promise<number> {
  if (category === "all") {
    return await deleteCachePattern("worksphere:*");
  }
  return await deleteCachePattern(`worksphere:${category}:*`);
}

/**
 * Check Redis health telemetry
 */
export async function getRedisHealth(): Promise<{
  status: "connected" | "disconnected" | "fallback_memory";
  engine: "redis" | "memory";
  latencyMs?: number;
  memoryKeysCount: number;
  url: string;
}> {
  const maskedUrl = REDIS_URL.replace(/:[^:@]*@/, ":***@");

  if (redisClient && redisClient.status === "ready") {
    try {
      const start = performance.now();
      await redisClient.ping();
      const latencyMs = Math.round(performance.now() - start);

      return {
        status: "connected",
        engine: "redis",
        latencyMs,
        memoryKeysCount: memoryFallback.size(),
        url: maskedUrl,
      };
    } catch {
      // PING failed
    }
  }

  return {
    status: "fallback_memory",
    engine: "memory",
    memoryKeysCount: memoryFallback.size(),
    url: maskedUrl,
  };
}

/**
 * Namespace key generator helpers
 */
export const CacheKeys = {
  dashboardMetrics: () => "worksphere:dashboard:metrics",
  dashboardActivity: () => "worksphere:dashboard:activity",
  plansList: () => "worksphere:plans:all",
  companiesList: (query: Record<string, any>) =>
    `worksphere:companies:list:${JSON.stringify(query)}`,
  companyDetail: (id: string) => `worksphere:companies:detail:${id}`,
  subscriptionsList: (query: Record<string, any>) =>
    `worksphere:subscriptions:list:${JSON.stringify(query)}`,
  paymentsList: (query: Record<string, any>) =>
    `worksphere:payments:list:${JSON.stringify(query)}`,
  paymentDetail: (id: string) => `worksphere:payments:detail:${id}`,
  ticketsList: (query: Record<string, any>) =>
    `worksphere:tickets:list:${JSON.stringify(query)}`,
  ticketDetail: (id: string) => `worksphere:tickets:detail:${id}`,
  auditLogsList: (query: Record<string, any>) =>
    `worksphere:audit:list:${JSON.stringify(query)}`,
};

export const redis = redisClient;
export const isRedisAvailable = () => Boolean(redisClient && redisClient.status === "ready");
export default redisClient;
