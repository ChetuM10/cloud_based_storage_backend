const { z } = require("zod");

// File upload init validation
const fileInitSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .max(255, "File name too long"),
  mimeType: z.string().min(1, "MIME type is required"),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024, "File size exceeds 100MB limit"),
  folderId: z.string().uuid().optional().nullable(),
});

// File complete validation
const fileCompleteSchema = z.object({
  fileId: z.string().uuid("Invalid file ID"),
  checksum: z.string().optional(),
});

// File update validation
const fileUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().uuid().optional().nullable(),
});

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

// Validate MIME type
const isAllowedMimeType = (mimeType) => {
  return (
    ALLOWED_MIME_TYPES.includes(mimeType) ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("text/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/")
  );
};

module.exports = {
  fileInitSchema,
  fileCompleteSchema,
  fileUpdateSchema,
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
};
