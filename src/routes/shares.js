const express = require("express");
const router = express.Router();
const { z } = require("zod");

const sharesController = require("../controllers/shares");
const { authenticate, optionalAuth } = require("../middleware/auth");
const {
  createShareSchema,
  createLinkShareSchema,
  accessLinkShareSchema,
} = require("../validators/shares");

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

// Public endpoint for accessing shared links
router.get("/link/:token", sharesController.accessLink);
router.post(
  "/link/:token",
  validateBody(accessLinkShareSchema),
  sharesController.accessLink
);

// All other routes require authentication
router.use(authenticate);

// Get items shared with me
router.get("/shared-with-me", sharesController.getSharedWithMe);

// Create share
router.post("/", validateBody(createShareSchema), sharesController.createShare);

// Get shares for a resource
router.get("/:resourceType/:resourceId", sharesController.getShares);

// Delete share
router.delete("/:id", sharesController.deleteShare);

// Link shares
router.post(
  "/links",
  validateBody(createLinkShareSchema),
  sharesController.createLinkShare
);
router.get("/links/:resourceType/:resourceId", sharesController.getLinkShares);
router.delete("/links/:id", sharesController.deleteLinkShare);

module.exports = router;
