const {
  parsePagination,
  paginatedResponse,
} = require("../../src/utils/pagination");

describe("Pagination Utilities", () => {
  describe("parsePagination", () => {
    it("should return default values when no query params", () => {
      const req = { query: {} };
      const result = parsePagination(req);

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      expect(result.page).toBe(1);
    });

    it("should parse page and calculate offset", () => {
      const req = { query: { page: "3", limit: "20" } };
      const result = parsePagination(req);

      expect(result.limit).toBe(20);
      expect(result.page).toBe(3);
      expect(result.offset).toBe(40); // (3-1) * 20
    });

    it("should enforce max limit", () => {
      const req = { query: { limit: "500" } };
      const result = parsePagination(req, { maxLimit: 100 });

      expect(result.limit).toBe(100);
    });

    it("should handle invalid values", () => {
      const req = { query: { page: "invalid", limit: "-5" } };
      const result = parsePagination(req);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(1); // Min limit is 1
    });
  });

  describe("paginatedResponse", () => {
    it("should create correct pagination metadata", () => {
      const data = [1, 2, 3];
      const total = 100;
      const limit = 10;
      const offset = 20;

      const result = paginatedResponse(data, total, limit, offset);

      expect(result.data).toEqual([1, 2, 3]);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it("should indicate no next page on last page", () => {
      const data = [1, 2];
      const total = 12;
      const limit = 10;
      const offset = 10;

      const result = paginatedResponse(data, total, limit, offset);

      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.nextPage).toBeNull();
    });

    it("should indicate no prev page on first page", () => {
      const data = [1, 2, 3];
      const total = 50;
      const limit = 10;
      const offset = 0;

      const result = paginatedResponse(data, total, limit, offset);

      expect(result.pagination.hasPrevPage).toBe(false);
      expect(result.pagination.prevPage).toBeNull();
    });
  });
});
