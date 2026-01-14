const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

// Create Supabase client with service role key for backend operations
const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create a function to get user-scoped client (for RLS if needed)
const createUserClient = (accessToken) => {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};

module.exports = {
  supabase,
  createUserClient,
};
