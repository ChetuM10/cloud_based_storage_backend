const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3001,

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || "drive",

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
};

// Validate required environment variables
const requiredEnvVars = [
  "jwtSecret",
  "jwtRefreshSecret",
  "supabaseUrl",
  "supabaseAnonKey",
  "supabaseServiceRoleKey",
];

for (const varName of requiredEnvVars) {
  if (!env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

module.exports = env;
