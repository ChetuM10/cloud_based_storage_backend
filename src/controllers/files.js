const { supabase } = require("../config/supabase");
const env = require("../config/env");
const { AppError } = require("../middleware/error-handler");
const { generateStorageKey, sanitizeFilename } = require("../utils/files");
const { isAllowedMimeType } = require("../validators/files");

// Initialize file upload - returns presigned URL
const initUpload = async (req, res, next) => {
  try {
    const { name, mimeType, sizeBytes, folderId } = req.body;
    const userId = req.user.id;

    // Validate MIME type
    if (!isAllowedMimeType(mimeType)) {
      throw new AppError("File type not allowed", 400, "INVALID_FILE_TYPE");
    }

    // Sanitize filename
    const sanitizedName = sanitizeFilename(name);
    if (!sanitizedName) {
      throw new AppError("Invalid file name", 400, "INVALID_FILE_NAME");
    }

    // Verify folder exists and belongs to user (if folderId provided)
    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, owner_id")
        .eq("id", folderId)
        .eq("is_deleted", false)
        .single();

      if (folderError || !folder) {
        throw new AppError("Folder not found", 404, "FOLDER_NOT_FOUND");
      }

      if (folder.owner_id !== userId) {
        // Check if user has editor access via shares
        const { data: share } = await supabase
          .from("shares")
          .select("role")
          .eq("resource_type", "folder")
          .eq("resource_id", folderId)
          .eq("grantee_user_id", userId)
          .eq("role", "editor")
          .single();

        if (!share) {
          throw new AppError(
            "No permission to upload to this folder",
            403,
            "PERMISSION_DENIED"
          );
        }
      }
    }

    // Create file record with pending status
    const { data: file, error: fileError } = await supabase
      .from("files")
      .insert({
        name: sanitizedName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        storage_key: `pending-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`, // Temporary key
        owner_id: userId,
        folder_id: folderId || null,
        upload_status: "pending",
      })
      .select("id")
      .single();

    if (fileError) {
      console.error("Failed to create file record:", fileError);
      throw new AppError(
        "Failed to initialize upload",
        500,
        "UPLOAD_INIT_FAILED"
      );
    }

    // Generate actual storage key
    const storageKey = generateStorageKey(
      userId,
      folderId,
      file.id,
      sanitizedName
    );

    // Update file with correct storage key
    await supabase
      .from("files")
      .update({ storage_key: storageKey, upload_status: "uploading" })
      .eq("id", file.id);

    // Generate presigned upload URL
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(env.supabaseStorageBucket)
      .createSignedUploadUrl(storageKey);

    if (uploadError) {
      console.error("Failed to create upload URL:", uploadError);
      // Clean up file record
      await supabase.from("files").delete().eq("id", file.id);
      throw new AppError(
        "Failed to generate upload URL",
        500,
        "UPLOAD_URL_FAILED"
      );
    }

    res.status(201).json({
      fileId: file.id,
      uploadUrl: uploadData.signedUrl,
      storageKey,
      token: uploadData.token,
    });
  } catch (error) {
    next(error);
  }
};

// Complete file upload
const completeUpload = async (req, res, next) => {
  try {
    const { fileId, checksum } = req.body;
    const userId = req.user.id;

    // Get file record
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }

    if (file.owner_id !== userId) {
      throw new AppError("Not authorized", 403, "PERMISSION_DENIED");
    }

    if (file.upload_status === "ready") {
      throw new AppError("File already uploaded", 400, "ALREADY_UPLOADED");
    }

    // Verify file exists in storage
    const { data: storageFile, error: storageError } = await supabase.storage
      .from(env.supabaseStorageBucket)
      .list(file.storage_key.split("/").slice(0, -1).join("/"), {
        search: file.storage_key.split("/").pop(),
      });

    // Update file status to ready
    const { data: updatedFile, error: updateError } = await supabase
      .from("files")
      .update({
        upload_status: "ready",
        checksum: checksum || null,
      })
      .eq("id", fileId)
      .select(
        "id, name, mime_type, size_bytes, folder_id, created_at, updated_at"
      )
      .single();

    if (updateError) {
      throw new AppError(
        "Failed to complete upload",
        500,
        "UPLOAD_COMPLETE_FAILED"
      );
    }

    // Log activity
    await supabase.from("activities").insert({
      actor_id: userId,
      action: "upload",
      resource_type: "file",
      resource_id: fileId,
      resource_name: file.name,
      context: { folderId: file.folder_id },
    });

    res.json({
      message: "Upload completed successfully",
      file: {
        id: updatedFile.id,
        name: updatedFile.name,
        mimeType: updatedFile.mime_type,
        sizeBytes: updatedFile.size_bytes,
        folderId: updatedFile.folder_id,
        createdAt: updatedFile.created_at,
        updatedAt: updatedFile.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get file details with download URL
const getFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get file
    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error || !file) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }

    // Check permission
    let hasAccess = file.owner_id === userId;

    if (!hasAccess) {
      // Check shares
      const { data: share } = await supabase
        .from("shares")
        .select("role")
        .eq("resource_type", "file")
        .eq("resource_id", id)
        .eq("grantee_user_id", userId)
        .single();

      hasAccess = !!share;

      // Check folder share if file is in a folder
      if (!hasAccess && file.folder_id) {
        const { data: folderShare } = await supabase
          .from("shares")
          .select("role")
          .eq("resource_type", "folder")
          .eq("resource_id", file.folder_id)
          .eq("grantee_user_id", userId)
          .single();

        hasAccess = !!folderShare;
      }
    }

    if (!hasAccess) {
      throw new AppError("Access denied", 403, "ACCESS_DENIED");
    }

    // Generate signed download URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(env.supabaseStorageBucket)
      .createSignedUrl(file.storage_key, 3600);

    if (urlError) {
      console.error("Failed to generate download URL:", urlError);
      throw new AppError(
        "Failed to generate download URL",
        500,
        "DOWNLOAD_URL_FAILED"
      );
    }

    // Check if starred
    const { data: star } = await supabase
      .from("stars")
      .select("user_id")
      .eq("user_id", userId)
      .eq("resource_type", "file")
      .eq("resource_id", id)
      .single();

    res.json({
      file: {
        id: file.id,
        name: file.name,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        folderId: file.folder_id,
        ownerId: file.owner_id,
        isOwner: file.owner_id === userId,
        isStarred: !!star,
        downloadUrl: urlData.signedUrl,
        createdAt: file.created_at,
        updatedAt: file.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update file (rename, move)
const updateFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, folderId } = req.body;
    const userId = req.user.id;

    // Get file
    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error || !file) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }

    // Check permission (owner or editor)
    let canEdit = file.owner_id === userId;

    if (!canEdit) {
      const { data: share } = await supabase
        .from("shares")
        .select("role")
        .eq("resource_type", "file")
        .eq("resource_id", id)
        .eq("grantee_user_id", userId)
        .eq("role", "editor")
        .single();

      canEdit = !!share;
    }

    if (!canEdit) {
      throw new AppError(
        "No permission to edit this file",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Build update object
    const updates = {};
    let action = null;

    if (name && name !== file.name) {
      updates.name = sanitizeFilename(name);
      action = "rename";
    }

    if (folderId !== undefined && folderId !== file.folder_id) {
      // Verify target folder
      if (folderId) {
        const { data: folder } = await supabase
          .from("folders")
          .select("id, owner_id")
          .eq("id", folderId)
          .eq("is_deleted", false)
          .single();

        if (!folder) {
          throw new AppError(
            "Target folder not found",
            404,
            "FOLDER_NOT_FOUND"
          );
        }
      }
      updates.folder_id = folderId;
      action = "move";
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ message: "No changes made", file });
    }

    // Update file
    const { data: updatedFile, error: updateError } = await supabase
      .from("files")
      .update(updates)
      .eq("id", id)
      .select(
        "id, name, mime_type, size_bytes, folder_id, created_at, updated_at"
      )
      .single();

    if (updateError) {
      throw new AppError("Failed to update file", 500, "UPDATE_FAILED");
    }

    // Log activity
    if (action) {
      await supabase.from("activities").insert({
        actor_id: userId,
        action,
        resource_type: "file",
        resource_id: id,
        resource_name: updatedFile.name,
        context: { previousName: file.name, previousFolderId: file.folder_id },
      });
    }

    res.json({
      message: "File updated successfully",
      file: {
        id: updatedFile.id,
        name: updatedFile.name,
        mimeType: updatedFile.mime_type,
        sizeBytes: updatedFile.size_bytes,
        folderId: updatedFile.folder_id,
        createdAt: updatedFile.created_at,
        updatedAt: updatedFile.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Soft delete file
const deleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get file
    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error || !file) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }

    // Only owner can delete
    if (file.owner_id !== userId) {
      throw new AppError(
        "Only the owner can delete this file",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("files")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (deleteError) {
      throw new AppError("Failed to delete file", 500, "DELETE_FAILED");
    }

    // Log activity
    await supabase.from("activities").insert({
      actor_id: userId,
      action: "delete",
      resource_type: "file",
      resource_id: id,
      resource_name: file.name,
    });

    res.json({ message: "File moved to trash" });
  } catch (error) {
    next(error);
  }
};

// Get file versions
const getVersions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check file exists and user has access
    const { data: file, error } = await supabase
      .from("files")
      .select("id, owner_id, name")
      .eq("id", id)
      .single();

    if (error || !file) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }

    // Check permission
    let hasAccess = file.owner_id === userId;
    if (!hasAccess) {
      const { data: share } = await supabase
        .from("shares")
        .select("role")
        .eq("resource_type", "file")
        .eq("resource_id", id)
        .eq("grantee_user_id", userId)
        .single();
      hasAccess = !!share;
    }

    if (!hasAccess) {
      throw new AppError("Access denied", 403, "ACCESS_DENIED");
    }

    // Get versions
    const { data: versions, error: versionsError } = await supabase
      .from("file_versions")
      .select("id, version_number, size_bytes, checksum, created_at")
      .eq("file_id", id)
      .order("version_number", { ascending: false });

    if (versionsError) {
      throw new AppError("Failed to get versions", 500, "VERSIONS_FAILED");
    }

    res.json({
      fileId: id,
      fileName: file.name,
      versions: versions || [],
    });
  } catch (error) {
    next(error);
  }
};

// Revert to a previous version
const revertToVersion = async (req, res, next) => {
  try {
    const { id, versionId } = req.params;
    const userId = req.user.id;

    // Check file exists and user owns it
    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (error || !file) {
      throw new AppError(
        "File not found or access denied",
        404,
        "FILE_NOT_FOUND"
      );
    }

    // Get the version to revert to
    const { data: version, error: versionError } = await supabase
      .from("file_versions")
      .select("*")
      .eq("id", versionId)
      .eq("file_id", id)
      .single();

    if (versionError || !version) {
      throw new AppError("Version not found", 404, "VERSION_NOT_FOUND");
    }

    // Create a new version from current file
    const { data: latestVersion } = await supabase
      .from("file_versions")
      .select("version_number")
      .eq("file_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

    // Save current as new version
    await supabase.from("file_versions").insert({
      file_id: id,
      version_number: nextVersionNumber,
      storage_key: file.storage_key,
      size_bytes: file.size_bytes,
      checksum: file.checksum,
    });

    // Update file to point to the reverted version's data
    await supabase
      .from("files")
      .update({
        storage_key: version.storage_key,
        size_bytes: version.size_bytes,
        checksum: version.checksum,
        current_version_id: version.id,
      })
      .eq("id", id);

    // Log activity
    await supabase.from("activities").insert({
      actor_id: userId,
      action: "revert",
      resource_type: "file",
      resource_id: id,
      context: { reverted_to_version: version.version_number },
    });

    res.json({
      message: "File reverted successfully",
      revertedToVersion: version.version_number,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initUpload,
  completeUpload,
  getFile,
  updateFile,
  deleteFile,
  getVersions,
  revertToVersion,
};
