import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let legacyClient: SupabaseClient<Database> | undefined;

function getLegacyClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Legacy Supabase is not configured. Use portable authentication or configure the legacy credentials.");
  }
  legacyClient ??= createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return legacyClient;
}

// Portable routes still import legacy helpers. Importing them must not start a
// second auth client or require Supabase credentials; actual legacy use fails closed.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    const client = getLegacyClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
