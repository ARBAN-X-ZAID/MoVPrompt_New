// Loads admin-edited agent profile overrides from the agent_profiles table.
// Uses the service-role key so it bypasses RLS (the function itself is auth-gated).
// 60-second in-memory cache to avoid querying on every request.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

interface AgentProfileRow {
  agent_id: string;
  display_name: string;
  doc_summary: string;
  system_addendum: string;
  examples: string;
  is_active: boolean;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { row: AgentProfileRow | null; fetchedAt: number }>();

let serviceClient: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (serviceClient) return serviceClient;
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

export async function getAgentProfile(agentId: string): Promise<AgentProfileRow | null> {
  const now = Date.now();
  const cached = cache.get(agentId);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.row;
  }

  const client = getServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from("agent_profiles")
    .select("agent_id, display_name, doc_summary, system_addendum, examples, is_active")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    console.error("getAgentProfile error:", error.message);
    return null;
  }

  const row = (data as AgentProfileRow | null) ?? null;
  cache.set(agentId, { row, fetchedAt: now });
  return row;
}
