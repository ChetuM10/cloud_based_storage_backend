const express = require("express");
const router = express.Router();
const { z } = require("zod");

const utilitiesController = require("../controllers/utilities");
const { authenticate } = require("../middleware/auth");

// Validation schemas
const starSchema = z.object({
  resourceType: z.enum(["file", "folder"]),
  resourceId: z.string().uuid(),
});

const restoreSchema = z.object({
  resourceType: z.enum(["file", "folder"]),
  resourceId: z.string().uuid(),
});

// Validation middleware
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

// Search
router.get("/search", utilitiesController.search);

// Stars
router.get("/starred", utilitiesController.getStarred);
router.post("/stars", validateBody(starSchema), utilitiesController.addStar);
router.delete(
  "/stars",
  validateBody(starSchema),
  utilitiesController.removeStar
);

// Trash
router.get("/trash", utilitiesController.getTrash);
router.post(
  "/trash/restore",
  validateBody(restoreSchema),
  utilitiesController.restoreFromTrash
);
router.post(
  "/trash/delete",
  validateBody(restoreSchema),
  utilitiesController.permanentDelete
);

// Recent files
router.get("/recent", utilitiesController.getRecent);

// Storage usage
router.get("/storage", utilitiesController.getStorageUsage);

module.exports = router;
