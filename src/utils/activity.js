const { supabase } = require("../config/supabase");

/**
 * Log an activity to the activities table
 * @param {Object} params - Activity parameters
 * @param {string} params.actorId - User ID performing the action
 * @param {string} params.action - Action type (upload, rename, delete, restore, move, share, download)
 * @param {string} params.resourceType - Resource type (file, folder)
 * @param {string} params.resourceId - Resource ID
 * @param {Object} params.context - Additional context (optional)
 */
const logActivity = async ({
  actorId,
  action,
  resourceType,
  resourceId,
  context = {},
}) => {
  try {
    await supabase.from("activities").insert({
      actor_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      context,
    });
  } catch (error) {
    // Don't throw - activity logging should never break the main operation
    console.error("Failed to log activity:", error);
  }
};

/**
 * Get activities for a user
 * @param {string} userId - User ID
 * @param {number} limit - Max results
 */
const getUserActivities = async (userId, limit = 50) => {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("actor_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

/**
 * Get activities for a specific resource
 * @param {string} resourceType - file or folder
 * @param {string} resourceId - Resource ID
 * @param {number} limit - Max results
 */
const getResourceActivities = async (resourceType, resourceId, limit = 50) => {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      *,
      actor:users(id, name, email)
    `
    )
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

module.exports = {
  logActivity,
  getUserActivities,
  getResourceActivities,
};
