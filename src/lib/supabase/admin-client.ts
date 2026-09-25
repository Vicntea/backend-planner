import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnv } from "@/config/env";

export function createSupabaseAdminClient(): SupabaseClient {
  const env = getSupabaseAdminEnv();

  return createClient(env.url, env.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
