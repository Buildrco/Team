import { createClient } from "@supabase/supabase-js";

    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const isPrivilegedBrowserKey = typeof key === "string" && (/^sb_secret_/i.test(key) || /sb_service_role/i.test(key) || /service_role/i.test(key));

    export const supabaseConfigError = !url || !key
    ? "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    : isPrivilegedBrowserKey
      ? "VITE_SUPABASE_ANON_KEY must contain the publishable/anon key, not a Supabase secret or service-role key."
      : null;

    export const supabase = !supabaseConfigError
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
    