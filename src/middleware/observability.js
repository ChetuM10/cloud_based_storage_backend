const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

/**
 * Middleware to add request ID for tracing
 */
function requestIdMiddleware(req, res, next) {
  req.id = req.headers["x-request-id"] || uuidv4();
  res.setHeader("X-Request-ID", req.id);
  next();
}

/**
 * Middleware to log request performance
 */
function performanceMiddleware(req, res, next) {
  const start = Date.now();

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - start;

    // Skip logging for health checks
    if (req.path.startsWith("/health")) {
      return;
    }

    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    };

    if (res.statusCode >= 400) {
      logger.warn("Request failed", logData);
    } else if (duration > 3000) {
      logger.warn("Slow request detected", logData);
    } else {
      logger.info("Request completed", logData);
    }
  });

  next();
}

/**
 * Enhanced error handler with logging
 */
function errorLoggerMiddleware(err, req, res, next) {
  logger.logError(req, err, {
    body: req.body,
    query: req.query,
    params: req.params,
  });
  next(err);
}

module.exports = {
  requestIdMiddleware,
  performanceMiddleware,
  errorLoggerMiddleware,
};
