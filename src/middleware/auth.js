const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { AppError } = require("./error-handler");
const { supabase } = require("../config/supabase");

// Authenticate user from JWT token
const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    // Verify JWT token
    const decoded = jwt.verify(token, env.jwtSecret);

    // Get user from database
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, name, image_url, created_at")
      .eq("id", decoded.userId)
      .single();

    if (error || !user) {
      throw new AppError("User not found", 401, "USER_NOT_FOUND");
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      next(error);
    } else {
      next(new AppError("Authentication failed", 401, "AUTH_FAILED"));
    }
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (token) {
      const decoded = jwt.verify(token, env.jwtSecret);
      const { data: user } = await supabase
        .from("users")
        .select("id, email, name, image_url, created_at")
        .eq("id", decoded.userId)
        .single();

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};
