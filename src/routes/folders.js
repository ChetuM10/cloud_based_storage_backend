const express = require("express");
const router = express.Router();
const { z } = require("zod");

const foldersController = require("../controllers/folders");
const { authenticate } = require("../middleware/auth");
const {
  createFolderSchema,
  updateFolderSchema,
} = require("../validators/folders");

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

// Create folder
router.post(
  "/",
  validateBody(createFolderSchema),
  foldersController.createFolder
);

// Get folder contents (use 'root' for root folder)
router.get("/:id", foldersController.getFolder);

// Get folder path (breadcrumbs)
router.get("/:id/path", foldersController.getFolderPath);

// Update folder (rename, move)
router.patch(
  "/:id",
  validateBody(updateFolderSchema),
  foldersController.updateFolder
);

// Delete folder (soft delete)
router.delete("/:id", foldersController.deleteFolder);

module.exports = router;
