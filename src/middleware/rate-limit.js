const rateLimit = require("express-rate-limit");

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // 500 requests per 5 minutes (relaxed for development)
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per 15 minutes (relaxed for development)
  message: {
    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: {
    error: {
      code: "UPLOAD_RATE_LIMIT_EXCEEDED",
      message: "Too many upload attempts, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
};
