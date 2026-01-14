const env = require("../config/env");

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let code = err.code || "INTERNAL_ERROR";

  // Handle specific error types
  if (err.name === "ValidationError" || err.name === "ZodError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = err.errors
      ? err.errors.map((e) => e.message).join(", ")
      : err.message;
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    code = "INVALID_TOKEN";
    message = "Invalid authentication token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    code = "TOKEN_EXPIRED";
    message = "Authentication token has expired";
  }

  // Don't expose internal errors in production
  if (env.nodeEnv === "production" && statusCode === 500) {
    message = "Internal server error";
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  AppError,
};
