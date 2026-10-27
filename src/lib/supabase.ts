import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseConfig } from "./supabaseConfig";

export { isSupabaseConfigured, supabaseConfig };

export const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
