/**
 * Validate environment variables at startup
 */
function validateEnv() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }

  // Warn about optional but recommended
  const recommended = ["REDIS_URL", "SENTRY_DSN"];
  const missingRecommended = recommended.filter((key) => !process.env[key]);

  if (missingRecommended.length > 0) {
    console.warn("⚠️  Missing recommended environment variables:");
    missingRecommended.forEach((key) => console.warn(`   - ${key}`));
  }
}

/**
 * Sanitize error for client response
 * @param {Error} error - Error object
 * @returns {Object} Sanitized error
 */
function sanitizeError(error) {
  // In production, don't expose stack traces or internal details
  if (process.env.NODE_ENV === "production") {
    return {
      code: error.code || "INTERNAL_ERROR",
      message: error.isOperational
        ? error.message
        : "An unexpected error occurred",
    };
  }

  // In development, show full error
  return {
    code: error.code || "INTERNAL_ERROR",
    message: error.message,
    stack: error.stack,
  };
}

/**
 * Sleep utility for retries
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 */
async function retry(fn, options = {}) {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Format bytes to human readable
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

module.exports = {
  validateEnv,
  sanitizeError,
  sleep,
  retry,
  formatBytes,
};
