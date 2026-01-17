const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabase");
const logger = require("../utils/logger");

// Full health check with all dependencies
router.get("/", async (req, res) => {
  const startTime = Date.now();
  const checks = {
    timestamp: new Date().toISOString(),
    status: "healthy",
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    checks: {},
  };

  // Database check
  try {
    const dbStart = Date.now();
    await supabase.from("users").select("id").limit(1);
    checks.checks.database = {
      status: "up",
      responseTime: Date.now() - dbStart,
    };
  } catch (err) {
    checks.status = "unhealthy";
    checks.checks.database = {
      status: "down",
      error: err.message,
    };
    logger.error("Health check failed: database", { error: err.message });
  }

  // Storage check
  try {
    const storageStart = Date.now();
    await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || "files")
      .list("", { limit: 1 });
    checks.checks.storage = {
      status: "up",
      responseTime: Date.now() - storageStart,
    };
  } catch (err) {
    checks.status = "unhealthy";
    checks.checks.storage = {
      status: "down",
      error: err.message,
    };
    logger.error("Health check failed: storage", { error: err.message });
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  checks.checks.memory = {
    status: "up",
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
    external: Math.round(memUsage.external / 1024 / 1024) + "MB",
  };

  checks.responseTime = Date.now() - startTime;

  const statusCode = checks.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(checks);
});

// Liveness probe - is the app running?
router.get("/live", (req, res) => {
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe - can the app serve traffic?
router.get("/ready", async (req, res) => {
  try {
    await supabase.from("users").select("id").limit(1);
    res.json({
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Readiness check failed", { error: err.message });
    res.status(503).json({
      status: "not ready",
      error: err.message,
    });
  }
});

module.exports = router;
