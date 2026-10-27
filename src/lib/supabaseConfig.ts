// Env-only config, safe to import from storefront code without pulling in supabase-js.
export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  storageBucket: "catalog-images",
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
