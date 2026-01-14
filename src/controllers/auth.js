const bcrypt = require("bcryptjs");
const { supabase } = require("../config/supabase");
const { AppError } = require("../middleware/error-handler");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} = require("../utils/jwt");

// Register a new user
const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.validatedBody;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      throw new AppError(
        "User with this email already exists",
        400,
        "USER_EXISTS"
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error } = await supabase
      .from("users")
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name: name || null,
      })
      .select("id, email, name, image_url, created_at")
      .single();

    if (error) {
      console.error("Supabase error:", error);
      throw new AppError("Failed to create user", 500, "CREATE_USER_FAILED");
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.image_url,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { email, password } = req.validatedBody;

    // Get user by email
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, name, image_url, password_hash, created_at")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.image_url,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Logout user
const logout = async (req, res, next) => {
  try {
    clearAuthCookies(res);

    res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
const me = async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        imageUrl: req.user.image_url,
        createdAt: req.user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Refresh access token
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new AppError("Refresh token not found", 401, "NO_REFRESH_TOKEN");
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, name, image_url, created_at")
      .eq("id", decoded.userId)
      .single();

    if (error || !user) {
      throw new AppError("User not found", 401, "USER_NOT_FOUND");
    }

    // Generate new tokens (rotation)
    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    // Set new cookies
    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.json({
      message: "Token refreshed successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.image_url,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      clearAuthCookies(res);
      return res.status(401).json({
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Invalid or expired refresh token",
        },
      });
    }
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  me,
  refresh,
};
