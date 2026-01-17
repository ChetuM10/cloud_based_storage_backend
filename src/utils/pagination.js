/**
 * Parse pagination parameters from request query
 * @param {Object} req - Express request object
 * @param {Object} options - Options
 * @returns {{ limit: number, offset: number, page: number }}
 */
function parsePagination(req, options = {}) {
  const { maxLimit = 100, defaultLimit = 50 } = options;

  const limit = Math.min(
    Math.max(parseInt(req.query.limit) || defaultLimit, 1),
    maxLimit
  );
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  return { limit, offset, page };
}

/**
 * Create paginated response
 * @param {Array} data - Items for current page
 * @param {number} total - Total count of all items
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @returns {Object} Paginated response
 */
function paginatedResponse(data, total, limit, offset) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    },
  };
}

/**
 * Apply pagination to Supabase query
 * @param {Object} query - Supabase query
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @returns {Object} Query with range applied
 */
function applyPagination(query, limit, offset) {
  return query.range(offset, offset + limit - 1);
}

module.exports = {
  parsePagination,
  paginatedResponse,
  applyPagination,
};
