const crypto = require("crypto");

// Generate a secure random token
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

// Generate a slug from filename
const generateSlug = (filename) => {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  // Convert to lowercase, replace spaces and special chars
  return nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
};

// Get file extension from filename
const getFileExtension = (filename) => {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
};

// Generate storage key for a file
const generateStorageKey = (ownerId, folderId, fileId, filename) => {
  const slug = generateSlug(filename);
  const ext = getFileExtension(filename);
  const folderPath = folderId ? `folders/${folderId}` : "root";

  return `${ownerId}/${folderPath}/${fileId}-${slug}${ext ? "." + ext : ""}`;
};

// Sanitize filename
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "") // Remove invalid characters
    .replace(/\.+/g, ".") // Remove multiple dots
    .trim();
};

// Format file size for display
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
};

module.exports = {
  generateSecureToken,
  generateSlug,
  getFileExtension,
  generateStorageKey,
  sanitizeFilename,
  formatFileSize,
};
