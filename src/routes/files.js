const express = require("express");
const router = express.Router();

const filesController = require("../controllers/files");
const { authenticate } = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/rate-limit");
const { validate } = require("../validators/auth");
const {
  fileInitSchema,
  fileCompleteSchema,
  fileUpdateSchema,
} = require("../validators/files");
const { z } = require("zod");

// Validation middleware for files
const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.errors.map((e) => e.message).join(", "),
          },
        });
      }
      next(error);
    }
  };
};

// All routes require authentication
router.use(authenticate);

// Initialize file upload (get presigned URL)
router.post(
  "/init",
  uploadLimiter,
  validateBody(fileInitSchema),
  filesController.initUpload
);

// Complete file upload
router.post(
  "/complete",
  validateBody(fileCompleteSchema),
  filesController.completeUpload
);

// Get file details with download URL
router.get("/:id", filesController.getFile);

// Update file (rename, move)
router.patch(
  "/:id",
  validateBody(fileUpdateSchema),
  filesController.updateFile
);

// Delete file (soft delete)
router.delete("/:id", filesController.deleteFile);

module.exports = router;
