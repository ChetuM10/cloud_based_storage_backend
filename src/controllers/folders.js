const { supabase } = require("../config/supabase");
const { AppError } = require("../middleware/error-handler");

// Create a new folder
const createFolder = async (req, res, next) => {
  try {
    const { name, parentId } = req.body;
    const userId = req.user.id;

    // Verify parent folder exists and user has access
    if (parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("folders")
        .select("id, owner_id")
        .eq("id", parentId)
        .eq("is_deleted", false)
        .single();

      if (parentError || !parent) {
        throw new AppError("Parent folder not found", 404, "PARENT_NOT_FOUND");
      }

      // Check permission
      if (parent.owner_id !== userId) {
        const { data: share } = await supabase
          .from("shares")
          .select("role")
          .eq("resource_type", "folder")
          .eq("resource_id", parentId)
          .eq("grantee_user_id", userId)
          .eq("role", "editor")
          .single();

        if (!share) {
          throw new AppError(
            "No permission to create folder here",
            403,
            "PERMISSION_DENIED"
          );
        }
      }
    }

    // Check for duplicate folder name in same location
    const { data: existing } = await supabase
      .from("folders")
      .select("id")
      .eq("owner_id", userId)
      .eq("name", name)
      .eq("is_deleted", false)
      .is("parent_id", parentId || null)
      .single();

    if (existing) {
      throw new AppError(
        "A folder with this name already exists here",
        400,
        "FOLDER_EXISTS"
      );
    }

    // Create folder
    const { data: folder, error } = await supabase
      .from("folders")
      .insert({
        name,
        owner_id: userId,
        parent_id: parentId || null,
      })
      .select("id, name, parent_id, created_at, updated_at")
      .single();

    if (error) {
      console.error("Failed to create folder:", error);
      throw new AppError("Failed to create folder", 500, "CREATE_FAILED");
    }

    // Log activity
    await supabase.from("activities").insert({
      actor_id: userId,
      action: "create_folder",
      resource_type: "folder",
      resource_id: folder.id,
      resource_name: folder.name,
      context: { parentId: parentId || null },
    });

    res.status(201).json({
      message: "Folder created successfully",
      folder: {
        id: folder.id,
        name: folder.name,
        parentId: folder.parent_id,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get folder with contents
const getFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isRoot = id === "root";

    let folder = null;
    let hasAccess = false;

    if (!isRoot) {
      // Get folder details
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("id", id)
        .eq("is_deleted", false)
        .single();

      if (error || !data) {
        throw new AppError("Folder not found", 404, "FOLDER_NOT_FOUND");
      }

      folder = data;
      hasAccess = folder.owner_id === userId;

      // Check share access
      if (!hasAccess) {
        const { data: share } = await supabase
          .from("shares")
          .select("role")
          .eq("resource_type", "folder")
          .eq("resource_id", id)
          .eq("grantee_user_id", userId)
          .single();

        hasAccess = !!share;
      }

      if (!hasAccess) {
        throw new AppError("Access denied", 403, "ACCESS_DENIED");
      }
    }

    // Get subfolders
    const foldersQuery = supabase
      .from("folders")
      .select("id, name, parent_id, owner_id, created_at, updated_at")
      .eq("is_deleted", false)
      .order("name");

    if (isRoot) {
      foldersQuery.eq("owner_id", userId).is("parent_id", null);
    } else {
      foldersQuery.eq("parent_id", id);
    }

    const { data: subfolders, error: subfoldersError } = await foldersQuery;

    // Get files
    const filesQuery = supabase
      .from("files")
      .select(
        "id, name, mime_type, size_bytes, owner_id, created_at, updated_at"
      )
      .eq("is_deleted", false)
      .eq("upload_status", "ready")
      .order("name");

    if (isRoot) {
      filesQuery.eq("owner_id", userId).is("folder_id", null);
    } else {
      filesQuery.eq("folder_id", id);
    }

    const { data: files, error: filesError } = await filesQuery;

    // Get starred items for this user
    const { data: stars } = await supabase
      .from("stars")
      .select("resource_type, resource_id")
      .eq("user_id", userId);

    const starredSet = new Set(
      (stars || []).map((s) => `${s.resource_type}:${s.resource_id}`)
    );

    // Format response
    const formattedFolders = (subfolders || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: "folder",
      parentId: f.parent_id,
      isOwner: f.owner_id === userId,
      isStarred: starredSet.has(`folder:${f.id}`),
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    const formattedFiles = (files || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: "file",
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      isOwner: f.owner_id === userId,
      isStarred: starredSet.has(`file:${f.id}`),
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    res.json({
      folder: isRoot
        ? { id: "root", name: "My Drive", parentId: null }
        : {
            id: folder.id,
            name: folder.name,
            parentId: folder.parent_id,
            isOwner: folder.owner_id === userId,
            createdAt: folder.created_at,
            updatedAt: folder.updated_at,
          },
      contents: [...formattedFolders, ...formattedFiles],
      counts: {
        folders: formattedFolders.length,
        files: formattedFiles.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get folder path (breadcrumbs)
const getFolderPath = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (id === "root") {
      return res.json({
        path: [{ id: "root", name: "My Drive" }],
      });
    }

    // Use recursive CTE to get path
    const { data, error } = await supabase.rpc("get_folder_path", {
      folder_id: id,
    });

    // If RPC doesn't exist, fallback to iterative approach
    if (error) {
      const path = [];
      let currentId = id;

      while (currentId) {
        const { data: folder } = await supabase
          .from("folders")
          .select("id, name, parent_id, owner_id")
          .eq("id", currentId)
          .eq("is_deleted", false)
          .single();

        if (!folder) break;

        // Check access on first iteration
        if (path.length === 0 && folder.owner_id !== userId) {
          const { data: share } = await supabase
            .from("shares")
            .select("role")
            .eq("resource_type", "folder")
            .eq("resource_id", currentId)
            .eq("grantee_user_id", userId)
            .single();

          if (!share) {
            throw new AppError("Access denied", 403, "ACCESS_DENIED");
          }
        }

        path.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent_id;
      }

      path.unshift({ id: "root", name: "My Drive" });

      return res.json({ path });
    }

    res.json({
      path: [{ id: "root", name: "My Drive" }, ...data],
    });
  } catch (error) {
    next(error);
  }
};

// Update folder (rename, move)
const updateFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, parentId } = req.body;
    const userId = req.user.id;

    // Get folder
    const { data: folder, error } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error || !folder) {
      throw new AppError("Folder not found", 404, "FOLDER_NOT_FOUND");
    }

    // Check permission
    let canEdit = folder.owner_id === userId;
    if (!canEdit) {
      const { data: share } = await supabase
        .from("shares")
        .select("role")
        .eq("resource_type", "folder")
        .eq("resource_id", id)
        .eq("grantee_user_id", userId)
        .eq("role", "editor")
        .single();

      canEdit = !!share;
    }

    if (!canEdit) {
      throw new AppError(
        "No permission to edit this folder",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Build updates
    const updates = {};
    let action = null;

    if (name && name !== folder.name) {
      // Check for duplicates
      const { data: existing } = await supabase
        .from("folders")
        .select("id")
        .eq("owner_id", folder.owner_id)
        .eq("name", name)
        .eq("is_deleted", false)
        .is("parent_id", folder.parent_id)
        .neq("id", id)
        .single();

      if (existing) {
        throw new AppError(
          "A folder with this name already exists",
          400,
          "FOLDER_EXISTS"
        );
      }

      updates.name = name;
      action = "rename";
    }

    if (parentId !== undefined && parentId !== folder.parent_id) {
      // Prevent moving folder into itself or its children
      if (parentId === id) {
        throw new AppError(
          "Cannot move folder into itself",
          400,
          "INVALID_MOVE"
        );
      }

      // Check if target is a descendant
      let checkId = parentId;
      while (checkId) {
        if (checkId === id) {
          throw new AppError(
            "Cannot move folder into its descendant",
            400,
            "INVALID_MOVE"
          );
        }
        const { data: checkFolder } = await supabase
          .from("folders")
          .select("parent_id")
          .eq("id", checkId)
          .single();

        checkId = checkFolder?.parent_id;
      }

      updates.parent_id = parentId;
      action = "move";
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ message: "No changes made", folder });
    }

    const { data: updatedFolder, error: updateError } = await supabase
      .from("folders")
      .update(updates)
      .eq("id", id)
      .select("id, name, parent_id, created_at, updated_at")
      .single();

    if (updateError) {
      throw new AppError("Failed to update folder", 500, "UPDATE_FAILED");
    }

    // Log activity
    if (action) {
      await supabase.from("activities").insert({
        actor_id: userId,
        action,
        resource_type: "folder",
        resource_id: id,
        resource_name: updatedFolder.name,
        context: {
          previousName: folder.name,
          previousParentId: folder.parent_id,
        },
      });
    }

    res.json({
      message: "Folder updated successfully",
      folder: {
        id: updatedFolder.id,
        name: updatedFolder.name,
        parentId: updatedFolder.parent_id,
        createdAt: updatedFolder.created_at,
        updatedAt: updatedFolder.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Soft delete folder
const deleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: folder, error } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error || !folder) {
      throw new AppError("Folder not found", 404, "FOLDER_NOT_FOUND");
    }

    if (folder.owner_id !== userId) {
      throw new AppError(
        "Only the owner can delete this folder",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Soft delete folder and all contents recursively
    // First, get all descendant folder IDs
    const descendantIds = [id];
    let currentLevel = [id];

    while (currentLevel.length > 0) {
      const { data: children } = await supabase
        .from("folders")
        .select("id")
        .in("parent_id", currentLevel)
        .eq("is_deleted", false);

      currentLevel = (children || []).map((c) => c.id);
      descendantIds.push(...currentLevel);
    }

    const now = new Date().toISOString();

    // Soft delete all descendant folders
    await supabase
      .from("folders")
      .update({ is_deleted: true, deleted_at: now })
      .in("id", descendantIds);

    // Soft delete all files in these folders
    await supabase
      .from("files")
      .update({ is_deleted: true, deleted_at: now })
      .in("folder_id", descendantIds);

    // Log activity
    await supabase.from("activities").insert({
      actor_id: userId,
      action: "delete",
      resource_type: "folder",
      resource_id: id,
      resource_name: folder.name,
    });

    res.json({ message: "Folder and contents moved to trash" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFolder,
  getFolder,
  getFolderPath,
  updateFolder,
  deleteFolder,
};
