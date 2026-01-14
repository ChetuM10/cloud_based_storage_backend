const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rate-limit");
const { validate, registerSchema, loginSchema } = require("../validators/auth");

// Public routes (with rate limiting)
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  authController.register
);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);

// Protected routes
router.get("/me", authenticate, authController.me);

module.exports = router;
