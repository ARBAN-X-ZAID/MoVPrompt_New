import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await callerClient.rpc("has_role", { _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Collect all users via pagination
    const allUserIds: string[] = [];
    const perPage = 200;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users ?? [];
      users.forEach((u) => allUserIds.push(u.id));
      if (users.length < perPage) break;
    }

    let count = 0;
    const failures: { userId: string; error: string }[] = [];
    for (const userId of allUserIds) {
      const { error } = await adminClient.auth.admin.signOut(userId, "global");
      if (error) {
        failures.push({ userId, error: error.message });
      } else {
        count++;
      }
    }

    // Record audit log entry
    await adminClient.from("admin_audit_log").insert({
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      action: "revoke_all_sessions",
      target_count: count,
      metadata: {
        total_users: allUserIds.length,
        failure_count: failures.length,
        failures: failures.slice(0, 20),
      },
    });

    return new Response(JSON.stringify({ success: true, count, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
