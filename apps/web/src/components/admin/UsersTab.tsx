import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Download, Search, ChevronLeft, ChevronRight, ShieldCheck, ShieldOff, LogOut, Loader2 } from "lucide-react";
import Sparkline from "./Sparkline";
import UserDetailDrawer, { type DrawerUser } from "./UserDetailDrawer";
import AdminActivityFeed from "./AdminActivityFeed";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface UserRow extends DrawerUser {
  last_30d: number;
  trend: number[];
}

const UsersTab = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [revoking, setRevoking] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const navigate = useNavigate();
  const pageSize = 10;

  const handleRevokeAllSessions = async () => {
    setRevoking(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-revoke-all-sessions", { body: {} });
      if (error) throw error;
      const count = data?.count ?? 0;
      toast.success(`Revoked ${count} session${count === 1 ? "" : "s"}`);
      setRevokeDialogOpen(false);
      // Caller's own session is now invalid — sign out locally and redirect
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (e: any) {
      toast.error(e?.message || "Failed to revoke sessions");
      setRevoking(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      if (!matchesRole) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (u.display_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    });
  }, [users, searchQuery, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

  useEffect(() => {
    fetchUsers();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    // Only call the admin-only meta function if we still have an authenticated session.
    // After "Revoke all sessions" or a stale mount, this would otherwise 401.
    const { data: sessionData } = await supabase.auth.getSession();
    const metaPromise = sessionData?.session
      ? supabase.functions.invoke("admin-list-users-meta", { body: {} }).catch((e) => {
          console.warn("admin-list-users-meta unavailable:", e);
          return { data: null } as { data: null };
        })
      : Promise.resolve({ data: null } as { data: null });

    const [
      { data: profiles },
      { data: roles },
      { data: events },
      { data: history },
      { data: recentEvents },
      metaResp,
    ] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("generation_events").select("user_id"),
      supabase.from("prompt_history").select("user_id"),
      supabase.from("generation_events").select("user_id, created_at").gte("created_at", thirtyDaysAgo),
      metaPromise,
    ]);

    const roleMap: Record<string, "admin" | "user"> = {};
    (roles || []).forEach((r) => {
      if (r.role === "admin") roleMap[r.user_id] = "admin";
    });

    const eventCount: Record<string, number> = {};
    (events || []).forEach((e) => {
      if (e.user_id) eventCount[e.user_id] = (eventCount[e.user_id] || 0) + 1;
    });
    const historyCount: Record<string, number> = {};
    (history || []).forEach((h) => {
      historyCount[h.user_id] = (historyCount[h.user_id] || 0) + 1;
    });
    const genCount: Record<string, number> = {};
    new Set([...Object.keys(eventCount), ...Object.keys(historyCount)]).forEach((uid) => {
      genCount[uid] = Math.max(eventCount[uid] || 0, historyCount[uid] || 0);
    });

    const now = new Date();
    const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const trendMap: Record<string, number[]> = {};
    const last30Map: Record<string, number> = {};
    (recentEvents || []).forEach((e) => {
      if (!e.user_id || !e.created_at) return;
      const d = new Date(e.created_at);
      const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const idx = 29 - Math.floor((todayKey - dayKey) / (24 * 60 * 60 * 1000));
      if (idx < 0 || idx > 29) return;
      if (!trendMap[e.user_id]) trendMap[e.user_id] = new Array(30).fill(0);
      trendMap[e.user_id][idx]++;
      last30Map[e.user_id] = (last30Map[e.user_id] || 0) + 1;
    });

    const metaMap: Record<string, {
      last_sign_in_at: string | null;
      email_confirmed_at: string | null;
      provider: string | null;
      is_active: boolean;
    }> = {};
    const metaUsers = (metaResp?.data?.users as any[] | undefined) ?? [];
    metaUsers.forEach((m) => {
      metaMap[m.id] = {
        last_sign_in_at: m.last_sign_in_at,
        email_confirmed_at: m.email_confirmed_at,
        provider: m.provider,
        is_active: !m.banned_until || new Date(m.banned_until) <= new Date(),
      };
    });

    const merged: UserRow[] = (profiles || []).map((p: any) => {
      const meta = metaMap[p.id];
      return {
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        role: roleMap[p.id] || "user",
        is_active: meta?.is_active ?? true,
        generations: genCount[p.id] || 0,
        last_30d: last30Map[p.id] || 0,
        trend: trendMap[p.id] || new Array(30).fill(0),
        last_sign_in_at: meta?.last_sign_in_at ?? null,
        email_confirmed_at: meta?.email_confirmed_at ?? null,
        provider: meta?.provider ?? null,
        admin_notes: p.admin_notes ?? null,
        admin_notes_updated_at: p.admin_notes_updated_at ?? null,
        admin_notes_updated_by: p.admin_notes_updated_by ?? null,
      };
    });

    setUsers(merged);
    setLoading(false);
  };

  const openDrawer = (user: UserRow) => {
    setActiveUser(user);
    setDrawerOpen(true);
  };

  const handleUserUpdated = (patch: Partial<DrawerUser> & { id: string }) => {
    setUsers((prev) => prev.map((u) => (u.id === patch.id ? { ...u, ...patch } : u)));
    setActiveUser((prev) => (prev && prev.id === patch.id ? { ...prev, ...patch } as UserRow : prev));
  };

  const handleUserDeleted = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  if (loading) {
    return <p className="text-muted-foreground animate-pulse py-8 text-center">Loading users...</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | "admin" | "user")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              disabled={revoking}
            >
              {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Revoke all sessions
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out all users?</AlertDialogTitle>
              <AlertDialogDescription>
                Approximately <span className="font-semibold text-foreground">{users.filter((u) => !!u.last_sign_in_at).length}</span> user{users.filter((u) => !!u.last_sign_in_at).length === 1 ? "" : "s"} have an active or recent session and will be signed out (estimated from sign-in history). This includes admins — you will be signed out too and redirected to the login page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleRevokeAllSessions(); }}
                disabled={revoking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revoking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Revoke all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="outline" size="sm" onClick={() => {
          const lines: string[] = [
            "=== MovPrompt Users Report ===", "",
            "Name,Email,Role,Generations,Status,Joined",
            ...users.map((u) => `"${(u.display_name || "—").replace(/"/g, '""')}","${u.email || "—"}","${u.role}","${u.generations}","${u.is_active ? "Active" : "Deactivated"}","${u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}"`),
          ];
          const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `movprompt-users-${new Date().toISOString().split("T")[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }} className="gap-2">
          <Download className="w-4 h-4" />
          Download Report
        </Button>
      </div>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium">All Users ({filteredUsers.length}{searchQuery ? ` of ${users.length}` : ""})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Generations</TableHead>
                <TableHead>30-day trend</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((u) => (
                <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {(u.display_name || u.email || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.generations > 0 ? (
                      <Badge variant="outline" className="text-xs border-primary/40 text-primary font-medium">
                        {u.generations}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Sparkline data={u.trend} />
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">
                        <ShieldOff className="w-3 h-3 mr-1" />
                        Deactivated
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openDrawer(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button variant="outline" size="icon" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <AdminActivityFeed />
      </div>

      <UserDetailDrawer
        user={activeUser}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUserUpdated={handleUserUpdated}
        onUserDeleted={handleUserDeleted}
        currentUserId={currentUserId}
      />
    </>
  );
};

export default UsersTab;
