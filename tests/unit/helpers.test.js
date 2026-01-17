const {
  validateEnv,
  sanitizeError,
  formatBytes,
  retry,
} = require("../../src/utils/helpers");

describe("Helper Utilities", () => {
  describe("formatBytes", () => {
    it("should format 0 bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("should format bytes", () => {
      expect(formatBytes(500)).toBe("500 B");
    });

    it("should format kilobytes", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
    });

    it("should format megabytes", () => {
      expect(formatBytes(1048576)).toBe("1 MB");
      expect(formatBytes(5242880)).toBe("5 MB");
    });

    it("should format gigabytes", () => {
      expect(formatBytes(1073741824)).toBe("1 GB");
    });
  });

  describe("sanitizeError", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("should hide stack in production", () => {
      process.env.NODE_ENV = "production";
      const error = new Error("Test error");
      error.stack = "some stack trace";

      const result = sanitizeError(error);

      expect(result.message).toBe("An unexpected error occurred");
      expect(result.stack).toBeUndefined();
    });

    it("should show stack in development", () => {
      process.env.NODE_ENV = "development";
      const error = new Error("Test error");
      error.stack = "some stack trace";

      const result = sanitizeError(error);

      expect(result.message).toBe("Test error");
      expect(result.stack).toBe("some stack trace");
    });

    it("should show operational errors in production", () => {
      process.env.NODE_ENV = "production";
      const error = new Error("File not found");
      error.isOperational = true;

      const result = sanitizeError(error);

      expect(result.message).toBe("File not found");
    });
  });

  describe("retry", () => {
    it("should return result on success", async () => {
      const fn = jest.fn().mockResolvedValue("success");

      const result = await retry(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure", async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("success");

      const result = await retry(fn, { maxAttempts: 3, baseDelay: 10 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should throw after max attempts", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("always fails"));

      await expect(
        retry(fn, { maxAttempts: 3, baseDelay: 10 })
      ).rejects.toThrow("always fails");

      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
