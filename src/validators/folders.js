const { z } = require("zod");

// Create folder validation
const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Folder name is required")
    .max(255, "Folder name too long")
    .refine((name) => !name.includes("/"), 'Folder name cannot contain "/"'),
  parentId: z.string().uuid().optional().nullable(),
});

// Update folder validation
const updateFolderSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .refine((name) => !name.includes("/"), 'Folder name cannot contain "/"')
    .optional(),
  parentId: z.string().uuid().optional().nullable(),
});

module.exports = {
  createFolderSchema,
  updateFolderSchema,
};
