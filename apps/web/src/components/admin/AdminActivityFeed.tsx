import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, ShieldAlert, Activity } from "lucide-react";

interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_count: number | null;
  metadata: any;
  created_at: string;
}

const ACTION_META: Record<string, { label: string; icon: typeof LogOut; tone: string }> = {
  revoke_all_sessions: {
    label: "Revoked all sessions",
    icon: LogOut,
    tone: "text-destructive",
  },
};

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const AdminActivityFeed = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setEntries(data as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Admin activity ({entries.length})
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchEntries} disabled={loading} className="gap-2 h-8">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading && entries.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8 animate-pulse">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No admin actions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => {
              const meta = ACTION_META[e.action] ?? {
                label: e.action,
                icon: ShieldAlert,
                tone: "text-muted-foreground",
              };
              const Icon = meta.icon;
              const failures = e.metadata?.failure_count ?? 0;
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`mt-0.5 ${meta.tone}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-sm">{meta.label}</span>
                      {typeof e.target_count === "number" && (
                        <Badge variant="secondary" className="text-xs">
                          {e.target_count} {e.target_count === 1 ? "user" : "users"}
                        </Badge>
                      )}
                      {failures > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {failures} failed
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by{" "}
                      <span className="text-foreground/80">
                        {e.actor_email ?? e.actor_id?.slice(0, 8) ?? "unknown"}
                      </span>{" "}
                      · {relativeTime(e.created_at)} ·{" "}
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminActivityFeed;
