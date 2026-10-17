import { Request, Response, NextFunction } from "express";
import {
  getCache,
  setCache,
  invalidateCacheCategory,
  deleteCachePattern,
  isRedisAvailable,
} from "../lib/redis";

export interface CacheOptions {
  /** TTL in seconds (default: 60) */
  ttlSeconds?: number;
  /** Optional prefix for key generation */
  prefix?: string;
  /** Optional custom key builder function */
  keyGenerator?: (req: Request) => string;
}

/**
 * Express middleware for transparent HTTP response caching in Redis
 */
export function cacheResponse(options: CacheOptions = {}) {
  const ttl = options.ttlSeconds ?? 60;
  const prefix = options.prefix ?? "route";

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache safe GET requests
    if (req.method !== "GET") {
      return next();
    }

    const queryString =
      req.query && Object.keys(req.query).length > 0
        ? JSON.stringify(
            Object.keys(req.query)
              .sort()
              .reduce((acc: any, k) => {
                acc[k] = req.query[k];
                return acc;
              }, {})
          )
        : "";

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : `worksphere:${prefix}:${req.baseUrl}${req.path}:${queryString}`;

    try {
      const cached = await getCache<{ statusCode: number; body: any }>(key);

      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Engine", isRedisAvailable() ? "redis" : "memory");
        return res.status(cached.statusCode || 200).json(cached.body);
      }

      res.setHeader("X-Cache", "MISS");
      res.setHeader("X-Cache-Engine", isRedisAvailable() ? "redis" : "memory");

      // Intercept res.json to store response
      const originalJson = res.json.bind(res);

      res.json = (body: any): Response => {
        // Only cache successful 200/201 responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Fire-and-forget setCache so we do not delay the HTTP response
          setCache(key, { statusCode: res.statusCode, body }, ttl).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      // If caching layer errors, degrade gracefully and continue to handler
      next();
    }
  };
}

export { invalidateCacheCategory, deleteCachePattern };
