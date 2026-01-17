CREATE INDEX IF NOT EXISTS idx_files_owner_folder_deleted 
ON files(owner_id, folder_id, is_deleted, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_files_name_gin 
ON files USING gin(to_tsvector('english', name)) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_files_mime_type 
ON files(mime_type) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_folders_owner_deleted 
ON folders(owner_id, is_deleted, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_folders_name_gin 
ON folders USING gin(to_tsvector('english', name)) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_shares_resource_lookup 
ON shares(resource_type, resource_id, grantee_user_id);

CREATE INDEX IF NOT EXISTS idx_shares_grantee 
ON shares(grantee_user_id);

CREATE INDEX IF NOT EXISTS idx_link_shares_token 
ON link_shares(token);

CREATE INDEX IF NOT EXISTS idx_link_shares_expires 
ON link_shares(expires_at) 
WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_actor_time 
ON activities(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_resource 
ON activities(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_files_trash 
ON files(owner_id, deleted_at DESC) 
WHERE is_deleted = true;

CREATE INDEX IF NOT EXISTS idx_folders_trash 
ON folders(owner_id, deleted_at DESC) 
WHERE is_deleted = true;

ANALYZE files;
ANALYZE folders;
ANALYZE shares;
ANALYZE link_shares;
ANALYZE activities;
