const { z } = require("zod");

// Create share validation
const createShareSchema = z.object({
  resourceType: z.enum(["file", "folder"]),
  resourceId: z.string().uuid(),
  granteeEmail: z.string().email("Invalid email address"),
  role: z.enum(["viewer", "editor"]),
});

// Create link share validation
const createLinkShareSchema = z.object({
  resourceType: z.enum(["file", "folder"]),
  resourceId: z.string().uuid(),
  expiresAt: z.string().datetime().optional().nullable(),
  password: z.string().min(4).max(100).optional(),
});

// Access link share validation
const accessLinkShareSchema = z.object({
  password: z.string().optional(),
});

module.exports = {
  createShareSchema,
  createLinkShareSchema,
  accessLinkShareSchema,
};
