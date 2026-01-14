const express = require("express");
const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API version endpoint
router.get("/api", (req, res) => {
  res.json({
    name: "Cloud Drive API",
    version: "1.0.0",
    documentation: "/api/docs",
  });
});

// Import route modules
const authRoutes = require("./auth");
const fileRoutes = require("./files");
const folderRoutes = require("./folders");
const shareRoutes = require("./shares");
const utilityRoutes = require("./utilities");

// Mount routes
router.use("/api/auth", authRoutes);
router.use("/api/files", fileRoutes);
router.use("/api/folders", folderRoutes);
router.use("/api/shares", shareRoutes);
router.use("/api", utilityRoutes);

module.exports = router;
