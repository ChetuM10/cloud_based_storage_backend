const bcrypt = require("bcryptjs");
const { supabase } = require("../config/supabase");
const env = require("../config/env");
const { AppError } = require("../middleware/error-handler");
const { generateSecureToken } = require("../utils/files");

// Create a share (per-user ACL)
const createShare = async (req, res, next) => {
  try {
    const { resourceType, resourceId, granteeEmail, role } = req.body;
    const userId = req.user.id;

    // Get resource to verify ownership
    const table = resourceType === "file" ? "files" : "folders";
    const { data: resource, error: resourceError } = await supabase
      .from(table)
      .select("id, owner_id, name")
      .eq("id", resourceId)
      .eq("is_deleted", false)
      .single();

    if (resourceError || !resource) {
      throw new AppError(
        `${resourceType} not found`,
        404,
        "RESOURCE_NOT_FOUND"
      );
    }

    // Only owner can share
    if (resource.owner_id !== userId) {
      throw new AppError(
        "Only the owner can share this resource",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Get grantee user
    const { data: grantee, error: granteeError } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("email", granteeEmail.toLowerCase())
      .single();

    if (granteeError || !grantee) {
      throw new AppError(
        "User not found. They must sign up first before you can share with them.",
        404,
        "USER_NOT_FOUND"
      );
    }

    // Can't share with yourself
    if (grantee.id === userId) {
      throw new AppError("Cannot share with yourself", 400, "INVALID_SHARE");
    }

    // Check for existing share
    const { data: existingShare } = await supabase
      .from("shares")
      .select("id, role")
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .eq("grantee_user_id", grantee.id)
      .single();

    if (existingShare) {
      // Update existing share
      const { data: updatedShare, error: updateError } = await supabase
        .from("shares")
        .update({ role })
        .eq("id", existingShare.id)
        .select("id, role, created_at")
        .single();

      if (updateError) {
        throw new AppError(
          "Failed to update share",
          500,
          "SHARE_UPDATE_FAILED"
        );
      }

      return res.json({
        message: "Share updated successfully",
        share: {
          id: updatedShare.id,
          resourceType,
          resourceId,
          grantee: { id: grantee.id, email: grantee.email, name: grantee.name },
          role: updatedShare.role,
          createdAt: updatedShare.created_at,
        },
      });
    }

    // Create new share
    const { data: share, error: shareError } = await supabase
      .from("shares")
      .insert({
        resource_type: resourceType,
        resource_id: resourceId,
        grantee_user_id: grantee.id,
        role,
        created_by: userId,
      })
      .select("id, role, created_at")
      .single();

    if (shareError) {
      console.error("Failed to create share:", shareError);
      throw new AppError("Failed to create share", 500, "SHARE_FAILED");
    }

    // Log activity
    await supabase.from("activities").insert({
      actor_id: userId,
      action: "share",
      resource_type: resourceType,
      resource_id: resourceId,
      resource_name: resource.name,
      context: { granteeEmail, role },
    });

    res.status(201).json({
      message: "Resource shared successfully",
      share: {
        id: share.id,
        resourceType,
        resourceId,
        grantee: { id: grantee.id, email: grantee.email, name: grantee.name },
        role: share.role,
        createdAt: share.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all shares for a resource
const getShares = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;
    const userId = req.user.id;

    // Verify resource exists and user has access
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

    if (resource.owner_id !== userId) {
      throw new AppError(
        "Only the owner can view shares",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Get shares with user info
    const { data: shares, error: sharesError } = await supabase
      .from("shares")
      .select(
        `
        id,
        role,
        created_at,
        grantee_user_id,
        users!shares_grantee_user_id_fkey(id, email, name, image_url)
      `
      )
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);

    if (sharesError) {
      throw new AppError("Failed to get shares", 500, "GET_SHARES_FAILED");
    }

    const formattedShares = (shares || []).map((s) => ({
      id: s.id,
      role: s.role,
      createdAt: s.created_at,
      grantee: s.users
        ? {
            id: s.users.id,
            email: s.users.email,
            name: s.users.name,
            imageUrl: s.users.image_url,
          }
        : null,
    }));

    res.json({ shares: formattedShares });
  } catch (error) {
    next(error);
  }
};

// Revoke a share
const deleteShare = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get share
    const { data: share, error } = await supabase
      .from("shares")
      .select("id, resource_type, resource_id, created_by")
      .eq("id", id)
      .single();

    if (error || !share) {
      throw new AppError("Share not found", 404, "SHARE_NOT_FOUND");
    }

    // Verify ownership
    const table = share.resource_type === "file" ? "files" : "folders";
    const { data: resource } = await supabase
      .from(table)
      .select("owner_id, name")
      .eq("id", share.resource_id)
      .single();

    if (resource?.owner_id !== userId) {
      throw new AppError(
        "Only the owner can revoke shares",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Delete share
    const { error: deleteError } = await supabase
      .from("shares")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new AppError("Failed to revoke share", 500, "REVOKE_FAILED");
    }

    // Log activity
    await supabase.from("activities").insert({
      actor_id: userId,
      action: "unshare",
      resource_type: share.resource_type,
      resource_id: share.resource_id,
      resource_name: resource?.name,
    });

    res.json({ message: "Share revoked successfully" });
  } catch (error) {
    next(error);
  }
};

// Create a public link share
const createLinkShare = async (req, res, next) => {
  try {
    const { resourceType, resourceId, expiresAt, password } = req.body;
    const userId = req.user.id;

    // Verify resource
    const table = resourceType === "file" ? "files" : "folders";
    const { data: resource, error } = await supabase
      .from(table)
      .select("id, owner_id, name")
      .eq("id", resourceId)
      .eq("is_deleted", false)
      .single();

    if (error || !resource) {
      throw new AppError("Resource not found", 404, "RESOURCE_NOT_FOUND");
    }

    if (resource.owner_id !== userId) {
      throw new AppError(
        "Only the owner can create public links",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Generate secure token
    const token = generateSecureToken(32);

    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Create link share
    const { data: linkShare, error: linkError } = await supabase
      .from("link_shares")
      .insert({
        resource_type: resourceType,
        resource_id: resourceId,
        token,
        password_hash: passwordHash,
        expires_at: expiresAt || null,
        created_by: userId,
      })
      .select("id, token, expires_at, created_at")
      .single();

    if (linkError) {
      console.error("Failed to create link share:", linkError);
      throw new AppError(
        "Failed to create public link",
        500,
        "LINK_CREATE_FAILED"
      );
    }

    // Generate public URL
    const publicUrl = `${env.corsOrigin}/public/${token}`;

    res.status(201).json({
      message: "Public link created successfully",
      linkShare: {
        id: linkShare.id,
        token: linkShare.token,
        publicUrl,
        hasPassword: !!password,
        expiresAt: linkShare.expires_at,
        createdAt: linkShare.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get link shares for a resource
const getLinkShares = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const table = resourceType === "file" ? "files" : "folders";
    const { data: resource } = await supabase
      .from(table)
      .select("owner_id")
      .eq("id", resourceId)
      .single();

    if (resource?.owner_id !== userId) {
      throw new AppError(
        "Only the owner can view link shares",
        403,
        "PERMISSION_DENIED"
      );
    }

    const { data: linkShares } = await supabase
      .from("link_shares")
      .select("id, token, expires_at, created_at, password_hash")
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);

    const formatted = (linkShares || []).map((ls) => ({
      id: ls.id,
      token: ls.token,
      publicUrl: `${env.corsOrigin}/public/${ls.token}`,
      hasPassword: !!ls.password_hash,
      expiresAt: ls.expires_at,
      createdAt: ls.created_at,
    }));

    res.json({ linkShares: formatted });
  } catch (error) {
    next(error);
  }
};

// Delete a link share
const deleteLinkShare = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: linkShare, error } = await supabase
      .from("link_shares")
      .select("id, resource_type, resource_id, created_by")
      .eq("id", id)
      .single();

    if (error || !linkShare) {
      throw new AppError("Link share not found", 404, "LINK_NOT_FOUND");
    }

    // Verify ownership
    const table = linkShare.resource_type === "file" ? "files" : "folders";
    const { data: resource } = await supabase
      .from(table)
      .select("owner_id")
      .eq("id", linkShare.resource_id)
      .single();

    if (resource?.owner_id !== userId) {
      throw new AppError(
        "Only the owner can delete link shares",
        403,
        "PERMISSION_DENIED"
      );
    }

    await supabase.from("link_shares").delete().eq("id", id);

    res.json({ message: "Link share deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// Access a public link (public endpoint)
const accessLink = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    // Get link share
    const { data: linkShare, error } = await supabase
      .from("link_shares")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !linkShare) {
      throw new AppError("Link not found or expired", 404, "LINK_NOT_FOUND");
    }

    // Check expiry
    if (linkShare.expires_at && new Date(linkShare.expires_at) < new Date()) {
      throw new AppError("Link has expired", 410, "LINK_EXPIRED");
    }

    // Check password
    if (linkShare.password_hash) {
      if (!password) {
        return res.status(401).json({
          error: {
            code: "PASSWORD_REQUIRED",
            message: "This link is password protected",
          },
          requiresPassword: true,
        });
      }

      const isValid = await bcrypt.compare(password, linkShare.password_hash);
      if (!isValid) {
        throw new AppError("Invalid password", 401, "INVALID_PASSWORD");
      }
    }

    // Get resource
    const table = linkShare.resource_type === "file" ? "files" : "folders";
    const { data: resource, error: resourceError } = await supabase
      .from(table)
      .select("*")
      .eq("id", linkShare.resource_id)
      .eq("is_deleted", false)
      .single();

    if (resourceError || !resource) {
      throw new AppError("Resource not found", 404, "RESOURCE_NOT_FOUND");
    }

    // For files, generate download URL
    let downloadUrl = null;
    if (linkShare.resource_type === "file") {
      const { data: urlData } = await supabase.storage
        .from(env.supabaseStorageBucket)
        .createSignedUrl(resource.storage_key, 3600);

      downloadUrl = urlData?.signedUrl;
    }

    res.json({
      resourceType: linkShare.resource_type,
      resource: {
        id: resource.id,
        name: resource.name,
        mimeType: resource.mime_type,
        sizeBytes: resource.size_bytes,
        downloadUrl,
        createdAt: resource.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get items shared with the current user
const getSharedWithMe = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all shares where user is grantee
    const { data: shares, error } = await supabase
      .from("shares")
      .select("id, resource_type, resource_id, role, created_at")
      .eq("grantee_user_id", userId);

    if (error) {
      throw new AppError(
        "Failed to get shared items",
        500,
        "GET_SHARED_FAILED"
      );
    }

    // Separate files and folders
    const fileIds =
      shares
        ?.filter((s) => s.resource_type === "file")
        .map((s) => s.resource_id) || [];
    const folderIds =
      shares
        ?.filter((s) => s.resource_type === "folder")
        .map((s) => s.resource_id) || [];

    // Get file details
    const { data: files } =
      fileIds.length > 0
        ? await supabase
            .from("files")
            .select(
              "id, name, mime_type, size_bytes, owner_id, created_at, updated_at"
            )
            .in("id", fileIds)
            .eq("is_deleted", false)
        : { data: [] };

    // Get folder details
    const { data: folders } =
      folderIds.length > 0
        ? await supabase
            .from("folders")
            .select("id, name, owner_id, created_at, updated_at")
            .in("id", folderIds)
            .eq("is_deleted", false)
        : { data: [] };

    // Get owner info
    const ownerIds = [
      ...new Set([
        ...(files || []).map((f) => f.owner_id),
        ...(folders || []).map((f) => f.owner_id),
      ]),
    ];

    const { data: owners } =
      ownerIds.length > 0
        ? await supabase
            .from("users")
            .select("id, name, email")
            .in("id", ownerIds)
        : { data: [] };

    const ownerMap = Object.fromEntries((owners || []).map((o) => [o.id, o]));

    // Format response
    const shareMap = Object.fromEntries(
      (shares || []).map((s) => [`${s.resource_type}:${s.resource_id}`, s])
    );

    const formattedFiles = (files || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: "file",
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      owner: ownerMap[f.owner_id] || null,
      role: shareMap[`file:${f.id}`]?.role,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    const formattedFolders = (folders || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: "folder",
      owner: ownerMap[f.owner_id] || null,
      role: shareMap[`folder:${f.id}`]?.role,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    res.json({
      items: [...formattedFolders, ...formattedFiles],
      counts: {
        folders: formattedFolders.length,
        files: formattedFiles.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createShare,
  getShares,
  deleteShare,
  createLinkShare,
  getLinkShares,
  deleteLinkShare,
  accessLink,
  getSharedWithMe,
};
