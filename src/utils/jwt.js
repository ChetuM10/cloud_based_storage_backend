const jwt = require("jsonwebtoken");
const env = require("../config/env");

// Generate access token (short-lived)
const generateAccessToken = (userId) => {
  return jwt.sign({ userId, type: "access" }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
};

// Generate refresh token (long-lived)
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId, type: "refresh" }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });
};

// Verify access token
const verifyAccessToken = (token) => {
  return jwt.verify(token, env.jwtSecret);
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.jwtRefreshSecret);
};

// Set auth cookies
const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = env.nodeEnv === "production";

  // Access token cookie (15 min)
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Refresh token cookie (7 days)
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth/refresh", // Only sent to refresh endpoint
  });
};

// Clear auth cookies
const clearAuthCookies = (res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
};
