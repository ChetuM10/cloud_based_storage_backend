// Test setup file
process.env.NODE_ENV = "test";

// Mock environment variables for tests
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-service-key";
process.env.CORS_ORIGIN = "http://localhost:3000";

// Increase timeout for integration tests
jest.setTimeout(10000);

// Clean up after tests
afterAll(async () => {
  // Close any open connections
});
