const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const env = require("./config/env");
const routes = require("./routes");
const healthRoutes = require("./routes/health");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");
const { apiLimiter } = require("./middleware/rate-limit");
const {
  requestIdMiddleware,
  performanceMiddleware,
  errorLoggerMiddleware,
} = require("./middleware/observability");
const logger = require("./utils/logger");

// Create Express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Request ID tracing (first middleware)
app.use(requestIdMiddleware);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: env.nodeEnv === "production",
    crossOriginEmbedderPolicy: env.nodeEnv === "production",
  })
);

// CORS configuration
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parsing
app.use(cookieParser());

// Performance monitoring
app.use(performanceMiddleware);

// Rate limiting
app.use(apiLimiter);

// Health check routes (no auth required)
app.use("/health", healthRoutes);

// API Routes
app.use(routes);

// 404 handler
app.use(notFoundHandler);

// Error logging middleware
app.use(errorLoggerMiddleware);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = env.port;

app.listen(PORT, () => {
  logger.info("Server started", {
    port: PORT,
    environment: env.nodeEnv,
    healthCheck: `http://localhost:${PORT}/health`,
  });

  console.log(`
🚀 Cloud Drive API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server running on port ${PORT}
🌍 Environment: ${env.nodeEnv}
🔗 Health check: http://localhost:${PORT}/health
📊 Logs: ./logs/combined.log
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

module.exports = app;
