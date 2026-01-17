const Redis = require("ioredis");
const logger = require("./logger");

// Check if Redis URL is configured
const redisUrl = process.env.REDIS_URL;
let redis = null;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redis.on("error", (err) => {
    logger.error("Redis error", { error: err.message });
  });

  redis.on("connect", () => {
    logger.info("Redis connected");
  });
}

/**
 * Cache wrapper - fetches from cache or executes function
 * @param {string} key - Cache key
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {Function} fetchFn - Function to execute on cache miss
 * @returns {Promise<any>} Cached or fresh data
 */
async function cached(key, ttlSeconds, fetchFn) {
  // If Redis not configured, just fetch
  if (!redis) {
    return await fetchFn();
  }

  try {
    // Try to get from cache
    const cachedData = await redis.get(key);
    if (cachedData) {
      logger.debug("Cache hit", { key });
      return JSON.parse(cachedData);
    }

    // Cache miss - fetch data
    logger.debug("Cache miss", { key });
    const data = await fetchFn();

    // Store in cache (fire and forget)
    redis
      .setex(key, ttlSeconds, JSON.stringify(data))
      .catch((err) =>
        logger.error("Cache set error", { key, error: err.message })
      );

    return data;
  } catch (err) {
    // If Redis fails, just fetch data
    logger.warn("Cache error, bypassing", { key, error: err.message });
    return await fetchFn();
  }
}

/**
 * Invalidate cache by key or pattern
 * @param {string} pattern - Cache key pattern (supports wildcard *)
 */
async function invalidateCache(pattern) {
  if (!redis) return;

  try {
    if (pattern.includes("*")) {
      // Pattern-based deletion
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug("Cache invalidated", { pattern, count: keys.length });
      }
    } else {
      // Single key deletion
      await redis.del(pattern);
      logger.debug("Cache invalidated", { key: pattern });
    }
  } catch (err) {
    logger.error("Cache invalidation error", { pattern, error: err.message });
  }
}

/**
 * Generate cache key for user-specific data
 * @param {string} userId - User ID
 * @param {string} resource - Resource type
 * @param {string} id - Optional resource ID
 * @returns {string} Cache key
 */
function cacheKey(userId, resource, id = "") {
  return `user:${userId}:${resource}${id ? `:${id}` : ""}`;
}

module.exports = {
  redis,
  cached,
  invalidateCache,
  cacheKey,
};
