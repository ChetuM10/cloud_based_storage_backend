const { supabase } = require("../config/supabase");
const env = require("../config/env");
const { AppError } = require("../middleware/error-handler");

// Search files and folders
const search = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { q, type, starred, limit = 50, offset = 0 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ results: [], total: 0 });
    }

    const searchTerm = `%${q.trim()}%`;
    const results = [];

    // Search files
    if (!type || type === "file" || type === "all") {
      let filesQuery = supabase
        .from("files")
        .select(
          "id, name, mime_type, size_bytes, folder_id, owner_id, created_at, updated_at",
          { count: "exact" }
        )
        .eq("is_deleted", false)
        .eq("upload_status", "ready")
        .eq("owner_id", userId)
        .ilike("name", searchTerm)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const {
        data: files,
        count: fileCount,
        error: filesError,
      } = await filesQuery;

      if (!filesError && files) {
        for (const f of files) {
          results.push({
            id: f.id,
            name: f.name,
            type: "file",
            mimeType: f.mime_type,
            sizeBytes: f.size_bytes,
            folderId: f.folder_id,
            createdAt: f.created_at,
            updatedAt: f.updated_at,
          });
        }
      }
    }

    // Search folders
    if (!type || type === "folder" || type === "all") {
      let foldersQuery = supabase
        .from("folders")
        .select("id, name, parent_id, owner_id, created_at, updated_at", {
          count: "exact",
        })
        .eq("is_deleted", false)
        .eq("owner_id", userId)
        .ilike("name", searchTerm)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const {
        data: folders,
        count: folderCount,
        error: foldersError,
      } = await foldersQuery;

      if (!foldersError && folders) {
        for (const f of folders) {
          results.push({
            id: f.id,
            name: f.name,
            type: "folder",
            parentId: f.parent_id,
            createdAt: f.created_at,
            updatedAt: f.updated_at,
          });
        }
      }
    }

    // Filter by starred if requested
    if (starred === "true") {
      const { data: stars } = await supabase
        .from("stars")
        .select("resource_type, resource_id")
        .eq("user_id", userId);

      const starredSet = new Set(
        (stars || []).map((s) => `${s.resource_type}:${s.resource_id}`)
      );

      const filteredResults = results.filter((r) =>
        starredSet.has(`${r.type}:${r.id}`)
      );

      return res.json({
        results: filteredResults,
        total: filteredResults.length,
        query: q,
      });
    }

    // Get starred status
    const { data: stars } = await supabase
      .from("stars")
      .select("resource_type, resource_id")
      .eq("user_id", userId);

    const starredSet = new Set(
      (stars || []).map((s) => `${s.resource_type}:${s.resource_id}`)
    );

    const enhancedResults = results.map((r) => ({
      ...r,
      isStarred: starredSet.has(`${r.type}:${r.id}`),
    }));

    res.json({
      results: enhancedResults,
      total: enhancedResults.length,
      query: q,
    });
  } catch (error) {
    next(error);
  }
};

// Star an item
const addStar = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.body;
    const userId = req.user.id;

    // Verify resource exists
    const table = resourceType === "file" ? "files" : "folders";
    const { data: resource, error } = await supabase
      .from(table)
      .select("id, owner_id")
      .eq("id", resourceId)
      .eq("is_deleted", false)
      .single();

    if (error || !resource) {
      throw new AppError("Resource not found", 404, "RESOURCE_NOT_FOUND");
    }

    // Check access
    let hasAccess = resource.owner_id === userId;
    if (!hasAccess) {
      const { data: share } = await supabase
        .from("shares")
        .select("role")
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId)
        .eq("grantee_user_id", userId)
        .single();

      hasAccess = !!share;
    }

    if (!hasAccess) {
      throw new AppError("Access denied", 403, "ACCESS_DENIED");
    }

    // Add star (upsert)
    const { error: starError } = await supabase.from("stars").upsert(
      {
        user_id: userId,
        resource_type: resourceType,
        resource_id: resourceId,
      },
      {
        onConflict: "user_id,resource_type,resource_id",
      }
    );

    if (starError) {
      throw new AppError("Failed to star item", 500, "STAR_FAILED");
    }

    res.json({ message: "Item starred successfully" });
  } catch (error) {
    next(error);
  }
};

// Remove star
const removeStar = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.body;
    const userId = req.user.id;

    const { error } = await supabase
      .from("stars")
      .delete()
      .eq("user_id", userId)
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);

    if (error) {
      throw new AppError("Failed to unstar item", 500, "UNSTAR_FAILED");
    }

    res.json({ message: "Item unstarred successfully" });
  } catch (error) {
    next(error);
  }
};

// Get starred items
const getStarred = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: stars, error } = await supabase
      .from("stars")
      .select("resource_type, resource_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError(
        "Failed to get starred items",
        500,
        "GET_STARRED_FAILED"
      );
    }

    const fileIds =
      stars
        ?.filter((s) => s.resource_type === "file")
        .map((s) => s.resource_id) || [];
    const folderIds =
      stars
        ?.filter((s) => s.resource_type === "folder")
        .map((s) => s.resource_id) || [];

    const { data: files } =
      fileIds.length > 0
        ? await supabase
            .from("files")
            .select(
              "id, name, mime_type, size_bytes, folder_id, created_at, updated_at"
            )
            .in("id", fileIds)
            .eq("is_deleted", false)
        : { data: [] };

    const { data: folders } =
      folderIds.length > 0
        ? await supabase
            .from("folders")
            .select("id, name, parent_id, created_at, updated_at")
            .in("id", folderIds)
            .eq("is_deleted", false)
        : { data: [] };

    const items = [
      ...(folders || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: "folder",
        parentId: f.parent_id,
        isStarred: true,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      })),
      ...(files || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: "file",
        mimeType: f.mime_type,
        sizeBytes: f.size_bytes,
        folderId: f.folder_id,
        isStarred: true,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      })),
    ];

    res.json({ items });
  } catch (error) {
    next(error);
  }
};

// Get trash items
const getTrash = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: files } = await supabase
      .from("files")
      .select("id, name, mime_type, size_bytes, deleted_at, created_at")
      .eq("owner_id", userId)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });

    const { data: folders } = await supabase
      .from("folders")
      .select("id, name, deleted_at, created_at")
      .eq("owner_id", userId)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });

    const items = [
      ...(folders || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: "folder",
        deletedAt: f.deleted_at,
        createdAt: f.created_at,
        // Calculate days until permanent deletion (30 days)
        daysUntilDeletion: Math.max(
          0,
          30 -
            Math.floor(
              (Date.now() - new Date(f.deleted_at).getTime()) /
                (1000 * 60 * 60 * 24)
            )
        ),
      })),
      ...(files || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: "file",
        mimeType: f.mime_type,
        sizeBytes: f.size_bytes,
        deletedAt: f.deleted_at,
        createdAt: f.created_at,
        daysUntilDeletion: Math.max(
          0,
          30 -
            Math.floor(
              (Date.now() - new Date(f.deleted_at).getTime()) /
                (1000 * 60 * 60 * 24)
            )
        ),
      })),
    ];

    res.json({ items });
  } catch (error) {
    next(error);
  }
};

// Restore from trash
const restoreFromTrash = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.body;
    const userId = req.user.id;

    const table = resourceType === "file" ? "files" : "folders";

    const { data: resource, error } = await supabase
      .from(table)
      .select("id, owner_id, name")
      .eq("id", resourceId)
      .eq("is_deleted", true)
      .single();

    if (error || !resource) {
      throw new AppError("Item not found in trash", 404, "NOT_FOUND");
    }

    if (resource.owner_id !== userId) {
      throw new AppError(
        "Only the owner can restore this item",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Restore item
    const { error: restoreError } = await supabase
      .from(table)
      .update({ is_deleted: false, deleted_at: null })
      .eq("id", resourceId);

    if (restoreError) {
      throw new AppError("Failed to restore item", 500, "RESTORE_FAILED");
    }

    // For folders, also restore children
    if (resourceType === "folder") {
      const descendantIds = [resourceId];
      let currentLevel = [resourceId];

      while (currentLevel.length > 0) {
        const { data: children } = await supabase
          .from("folders")
          .select("id")
          .in("parent_id", currentLevel)
          .eq("is_deleted", true);

        currentLevel = (children || []).map((c) => c.id);
        descendantIds.push(...currentLevel);
      }

      if (descendantIds.length > 1) {
        await supabase
          .from("folders")
          .update({ is_deleted: false, deleted_at: null })
          .in("id", descendantIds.slice(1));

        await supabase
          .from("files")
          .update({ is_deleted: false, deleted_at: null })
          .in("folder_id", descendantIds);
      }
    }

    // Log activity
    await supabase.from("activities").insert({
      actor_id: userId,
      action: "restore",
      resource_type: resourceType,
      resource_id: resourceId,
      resource_name: resource.name,
    });

    res.json({ message: "Item restored successfully" });
  } catch (error) {
    next(error);
  }
};

// Permanently delete from trash
const permanentDelete = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.body;
    const userId = req.user.id;

    const table = resourceType === "file" ? "files" : "folders";

    const { data: resource, error } = await supabase
      .from(table)
      .select("id, owner_id, storage_key, name")
      .eq("id", resourceId)
      .eq("is_deleted", true)
      .single();

    if (error || !resource) {
      throw new AppError("Item not found in trash", 404, "NOT_FOUND");
    }

    if (resource.owner_id !== userId) {
      throw new AppError(
        "Only the owner can permanently delete this item",
        403,
        "PERMISSION_DENIED"
      );
    }

    if (resourceType === "file") {
      // Delete from storage
      await supabase.storage
        .from(env.supabaseStorageBucket)
        .remove([resource.storage_key]);

      // Delete from database
      await supabase.from("files").delete().eq("id", resourceId);
    } else {
      // For folders, delete all descendant files from storage first
      const descendantIds = [resourceId];
      let currentLevel = [resourceId];

      while (currentLevel.length > 0) {
        const { data: children } = await supabase
          .from("folders")
          .select("id")
          .in("parent_id", currentLevel);

        currentLevel = (children || []).map((c) => c.id);
        descendantIds.push(...currentLevel);
      }

      // Get all files in these folders
      const { data: filesToDelete } = await supabase
        .from("files")
        .select("storage_key")
        .in("folder_id", descendantIds);

      if (filesToDelete && filesToDelete.length > 0) {
        await supabase.storage
          .from(env.supabaseStorageBucket)
          .remove(filesToDelete.map((f) => f.storage_key));
      }

      // Delete files
      await supabase.from("files").delete().in("folder_id", descendantIds);

      // Delete folders
      await supabase.from("folders").delete().in("id", descendantIds);
    }

    // Clean up related records
    await supabase
      .from("shares")
      .delete()
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);

    await supabase
      .from("link_shares")
      .delete()
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);

    await supabase
      .from("stars")
      .delete()
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);

    res.json({ message: "Item permanently deleted" });
  } catch (error) {
    next(error);
  }
};

// Get recent files
const getRecent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Get recently updated files
    const { data: files, error } = await supabase
      .from("files")
      .select(
        "id, name, mime_type, size_bytes, folder_id, created_at, updated_at"
      )
      .eq("owner_id", userId)
      .eq("is_deleted", false)
      .eq("upload_status", "ready")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new AppError(
        "Failed to get recent files",
        500,
        "GET_RECENT_FAILED"
      );
    }

    // Get starred status
    const fileIds = (files || []).map((f) => f.id);
    const { data: stars } =
      fileIds.length > 0
        ? await supabase
            .from("stars")
            .select("resource_id")
            .eq("user_id", userId)
            .eq("resource_type", "file")
            .in("resource_id", fileIds)
        : { data: [] };

    const starredSet = new Set((stars || []).map((s) => s.resource_id));

    const items = (files || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: "file",
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      folderId: f.folder_id,
      isStarred: starredSet.has(f.id),
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    res.json({ items });
  } catch (error) {
    next(error);
  }
};

// Get storage usage
const getStorageUsage = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("files")
      .select("size_bytes")
      .eq("owner_id", userId)
      .eq("is_deleted", false);

    if (error) {
      throw new AppError(
        "Failed to get storage usage",
        500,
        "GET_USAGE_FAILED"
      );
    }

    const totalBytes = (data || []).reduce(
      (sum, f) => sum + (f.size_bytes || 0),
      0
    );
    const fileCount = (data || []).length;

    // Get folder count
    const { count: folderCount } = await supabase
      .from("folders")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("is_deleted", false);

    res.json({
      usage: {
        totalBytes,
        fileCount,
        folderCount: folderCount || 0,
        // Placeholder for quota (can be implemented later)
        quotaBytes: 15 * 1024 * 1024 * 1024, // 15 GB default
        usagePercent: ((totalBytes / (15 * 1024 * 1024 * 1024)) * 100).toFixed(
          2
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  search,
  addStar,
  removeStar,
  getStarred,
  getTrash,
  restoreFromTrash,
  permanentDelete,
  getRecent,
  getStorageUsage,
};
