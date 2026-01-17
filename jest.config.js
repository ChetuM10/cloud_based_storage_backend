module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js", "!src/app.js", "!src/config/**"],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ["./tests/setup.js"],
};
