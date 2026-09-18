import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity, Calendar, Clock, MailCheck, MailWarning, ShieldAlert,
  KeyRound, Send, LogOut, Trash2, Copy, Image as ImageIcon,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

export interface DrawerUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  role: "admin" | "user";
  is_active: boolean;
  generations: number;
  last_30d?: number;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  provider?: string | null;
  admin_notes?: string | null;
  admin_notes_updated_at?: string | null;
  admin_notes_updated_by?: string | null;
}

interface Props {
  user: DrawerUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: (u: Partial<DrawerUser> & { id: string }) => void;
  onUserDeleted: (id: string) => void;
  currentUserId: string | null;
}

interface RecentPrompt {
  id: string;
  workflow_type: string;
  target_model: string;
  created_at: string | null;
  image_paths: string[] | null;
  thumbUrl?: string;
}

const relativeTime = (iso?: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const UserDetailDrawer = ({ user, open, onOpenChange, onUserUpdated, onUserDeleted, currentUserId }: Props) => {
  const { t } = useLanguage();
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [notes, setNotes] = useState("");
  const [notesEditedAt, setNotesEditedAt] = useState<string | null>(null);
  const [notesSaving, setNotesSaving] = useState(false);

  const [recentPrompts, setRecentPrompts] = useState<RecentPrompt[]>([]);
  const [workflowBreakdown, setWorkflowBreakdown] = useState<Record<string, number>>({});
  const [lastActive, setLastActive] = useState<string | null>(null);
  const [suppressionReason, setSuppressionReason] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isSelf = !!user && user.id === currentUserId;

  useEffect(() => {
    if (!user) return;
    setEditName(user.display_name || "");
    setEditRole(user.role);
    setEditActive(user.is_active);
    setNotes(user.admin_notes || "");
    setNotesEditedAt(user.admin_notes_updated_at || null);
    fetchDrawerDetails(user);
  }, [user]);

  const fetchDrawerDetails = async (u: DrawerUser) => {
    setLoadingDetails(true);
    setRecentPrompts([]);
    setWorkflowBreakdown({});
    setLastActive(null);
    setSuppressionReason(null);

    const [{ data: events }, { data: prompts }, { data: suppression }] = await Promise.all([
      supabase
        .from("generation_events")
        .select("workflow_type, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("prompt_history")
        .select("id, workflow_type, target_model, created_at, image_paths")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(5),
      u.email
        ? supabase.from("suppressed_emails").select("reason").eq("email", u.email).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    if (events && events.length > 0) {
      setLastActive(events[0].created_at);
      const breakdown: Record<string, number> = {};
      events.forEach((e) => {
        breakdown[e.workflow_type] = (breakdown[e.workflow_type] || 0) + 1;
      });
      setWorkflowBreakdown(breakdown);
    }

    if (suppression?.reason) setSuppressionReason(suppression.reason);

    if (prompts) {
      const withThumbs = await Promise.all(
        prompts.map(async (p): Promise<RecentPrompt> => {
          let thumbUrl: string | undefined;
          const firstPath = p.image_paths?.[0];
          if (firstPath) {
            const { data } = await supabase.storage
              .from("generation-images")
              .createSignedUrl(firstPath, 3600);
            thumbUrl = data?.signedUrl;
          }
          return { ...p, thumbUrl };
        })
      );
      setRecentPrompts(withThumbs);
    }

    setLoadingDetails(false);
  };

  const handleToggleStatus = async (activate: boolean) => {
    if (!user) return;
    setTogglingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("toggle-user-status", {
        body: { userId: user.id, ban: !activate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEditActive(activate);
      onUserUpdated({ id: user.id, is_active: activate });
      toast({
        title: activate ? t("admin.userDrawer.activated") : t("admin.userDrawer.deactivated"),
      });
    } catch (e: any) {
      toast({ title: t("admin.userDrawer.error"), description: e.message, variant: "destructive" });
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: editName })
        .eq("id", user.id);
      if (profileError) throw profileError;

      if (editRole !== user.role) {
        if (editRole === "admin") {
          const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", "admin");
          if (error) throw error;
        }
      }

      onUserUpdated({ id: user.id, display_name: editName, role: editRole });
      toast({ title: t("admin.userDrawer.saved") });
    } catch (e: any) {
      toast({ title: t("admin.userDrawer.error"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleNotesBlur = async () => {
    if (!user) return;
    if ((notes || "") === (user.admin_notes || "")) return;
    setNotesSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("profiles")
        .update({
          admin_notes: notes || null,
          admin_notes_updated_by: currentUserId,
          admin_notes_updated_at: now,
        })
        .eq("id", user.id);
      if (error) throw error;
      setNotesEditedAt(now);
      onUserUpdated({ id: user.id, admin_notes: notes, admin_notes_updated_at: now });
      toast({ title: t("admin.userDrawer.notesSaved") });
    } catch (e: any) {
      toast({ title: t("admin.userDrawer.error"), description: e.message, variant: "destructive" });
    } finally {
      setNotesSaving(false);
    }
  };

  const callAdminAction = async (
    fn: string,
    body: any,
    successKey: string,
    actionId: string,
  ) => {
    setActionLoading(actionId);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: t(successKey as any) });
      return true;
    } catch (e: any) {
      toast({ title: t("admin.userDrawer.error"), description: e.message, variant: "destructive" });
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handlePasswordReset = () =>
    user?.email &&
    callAdminAction(
      "admin-send-password-reset",
      { userId: user.id, email: user.email },
      "admin.userDrawer.resetSent",
      "reset",
    );

  const handleResendWelcome = () =>
    user?.email &&
    callAdminAction(
      "admin-resend-welcome",
      { email: user.email, name: user.display_name },
      "admin.userDrawer.welcomeSent",
      "welcome",
    );

  const handleForceSignout = () =>
    user &&
    callAdminAction(
      "admin-force-signout",
      { userId: user.id },
      "admin.userDrawer.signedOut",
      "signout",
    );

  const handleDeleteUser = async () => {
    if (!user || deleteConfirmText !== user.email) return;
    const ok = await callAdminAction(
      "admin-delete-user",
      { userId: user.id },
      "admin.userDrawer.deleted",
      "delete",
    );
    if (ok) {
      setConfirmDeleteOpen(false);
      setDeleteConfirmText("");
      onUserDeleted(user.id);
      onOpenChange(false);
    }
  };

  const copyId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.id);
    toast({ title: t("admin.userDrawer.idCopied") });
  };

  if (!user) return null;

  const workflowLabel = Object.entries(workflowBreakdown)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto p-0"
        >
          <div className="p-6 space-y-6">
            <SheetHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback>
                    {(user.display_name || user.email || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">
                    {user.display_name || user.email || "—"}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={copyId} title={t("admin.userDrawer.copyId")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </SheetHeader>

            {/* Activity snapshot */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.userDrawer.activity")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <StatTile icon={<Activity className="h-3.5 w-3.5" />} label={t("admin.userDrawer.totalGen")} value={user.generations.toString()} />
                <StatTile icon={<Calendar className="h-3.5 w-3.5" />} label={t("admin.userDrawer.last30")} value={(user.last_30d ?? 0).toString()} />
                <StatTile icon={<Clock className="h-3.5 w-3.5" />} label={t("admin.userDrawer.lastActive")} value={relativeTime(lastActive)} />
                <StatTile icon={<KeyRound className="h-3.5 w-3.5" />} label={t("admin.userDrawer.lastSignIn")} value={relativeTime(user.last_sign_in_at)} />
              </div>
              {workflowLabel && (
                <p className="text-xs text-muted-foreground pt-1">{workflowLabel}</p>
              )}
            </section>

            {/* Recent prompts */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.userDrawer.recentPrompts")}
              </h3>
              {loadingDetails ? (
                <p className="text-xs text-muted-foreground py-3">{t("admin.userDrawer.loading")}</p>
              ) : recentPrompts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">{t("admin.userDrawer.noPrompts")}</p>
              ) : (
                <div className="space-y-1.5">
                  {recentPrompts.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-md border border-border bg-card/50 p-2">
                      <div className="h-10 w-10 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {p.thumbUrl ? (
                          <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] py-0 h-4">{p.workflow_type}</Badge>
                          <Badge variant="outline" className="text-[10px] py-0 h-4">{p.target_model}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{relativeTime(p.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground italic pt-1">
                    {t("admin.userDrawer.fullLibrarySoon")}
                  </p>
                </div>
              )}
            </section>

            {/* Email & communication */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.userDrawer.email")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.email_confirmed_at ? (
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs">
                    <MailCheck className="h-3 w-3 mr-1" />
                    {t("admin.userDrawer.verified")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">
                    <MailWarning className="h-3 w-3 mr-1" />
                    {t("admin.userDrawer.unverified")}
                  </Badge>
                )}
                {user.provider && (
                  <Badge variant="outline" className="text-xs">
                    {user.provider}
                  </Badge>
                )}
                {suppressionReason && (
                  <Badge variant="outline" className="border-destructive/50 text-destructive text-xs">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    {suppressionReason}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasswordReset}
                  disabled={!user.email || actionLoading === "reset"}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                  {t("admin.userDrawer.sendReset")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendWelcome}
                  disabled={!user.email || actionLoading === "welcome"}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {t("admin.userDrawer.resendWelcome")}
                </Button>
              </div>
            </section>

            {/* Account */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.userDrawer.account")}
              </h3>
              <div>
                <Label htmlFor="d-name" className="text-xs">{t("admin.userDrawer.displayName")}</Label>
                <Input id="d-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">{t("admin.userDrawer.role")}</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as "admin" | "user")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t("admin.userDrawer.status")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {editActive ? t("admin.userDrawer.statusActive") : t("admin.userDrawer.statusBlocked")}
                  </p>
                </div>
                <Switch
                  checked={editActive}
                  onCheckedChange={handleToggleStatus}
                  disabled={togglingStatus || isSelf}
                />
              </div>
              <Button onClick={handleSaveAccount} disabled={saving} size="sm">
                {saving ? t("admin.userDrawer.saving") : t("admin.userDrawer.saveChanges")}
              </Button>
            </section>

            {/* Admin notes */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.userDrawer.notes")}
              </h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder={t("admin.userDrawer.notesPlaceholder")}
                rows={4}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                {notesSaving
                  ? t("admin.userDrawer.notesSaving")
                  : notesEditedAt
                  ? `${t("admin.userDrawer.notesLastEdited")} ${relativeTime(notesEditedAt)}`
                  : t("admin.userDrawer.notesNone")}
              </p>
            </section>

            {/* Danger zone */}
            <section className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                {t("admin.userDrawer.dangerZone")}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("admin.userDrawer.forceSignOut")}</p>
                    <p className="text-xs text-muted-foreground">{t("admin.userDrawer.forceSignOutDesc")}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleForceSignout}
                    disabled={isSelf || actionLoading === "signout"}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                  >
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    {t("admin.userDrawer.signOutBtn")}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-destructive/20">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("admin.userDrawer.deleteAccount")}</p>
                    <p className="text-xs text-muted-foreground">{t("admin.userDrawer.deleteAccountDesc")}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (isSelf) {
                        toast({ title: t("admin.userDrawer.cannotSelf"), variant: "destructive" });
                        return;
                      }
                      setConfirmDeleteOpen(true);
                    }}
                    disabled={isSelf}
                    className="shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("admin.userDrawer.deleteBtn")}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.userDrawer.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.userDrawer.confirmDeleteDesc")} <strong className="text-foreground">{user.email}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder={user.email || ""}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
              {t("admin.userDrawer.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteConfirmText !== user.email || actionLoading === "delete"}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("admin.userDrawer.deletePermanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const StatTile = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-md border border-border bg-card/50 p-2.5">
    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
      {icon}
      <span>{label}</span>
    </div>
    <p className="text-base font-semibold mt-1 truncate">{value}</p>
  </div>
);

export default UserDetailDrawer;
