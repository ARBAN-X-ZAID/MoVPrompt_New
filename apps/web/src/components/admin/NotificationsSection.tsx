import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Bell, Send } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface Notification {
  id: string;
  title: string;
  title_ar: string | null;
  message: string;
  message_ar: string | null;
  type: string;
  created_at: string;
}

const NotificationsSection = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", title_ar: "", message: "", message_ar: "", type: "info" });
  const [sending, setSending] = useState(false);
  const { t } = useLanguage();

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("notifications").insert({
      title: form.title,
      title_ar: form.title_ar || null,
      message: form.message,
      message_ar: form.message_ar || null,
      type: form.type,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notification sent", description: "All users will see this notification." });
      setForm({ title: "", title_ar: "", message: "", message_ar: "", type: "info" });
      setDialogOpen(false);
      fetchNotifications();
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    toast({ title: "Notification deleted" });
    fetchNotifications();
  };

  const typeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      info: "default",
      update: "secondary",
      alert: "destructive",
    };
    return <Badge variant={variants[type] || "outline"}>{type}</Badge>;
  };

  if (loading) return <p className="text-muted-foreground animate-pulse">Loading notifications...</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="w-5 h-5 text-primary" /> Push Notifications
        </CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> New Notification
        </Button>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No notifications sent yet. Send your first one!
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title (EN / AR)</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="w-12 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">
                    <div>{n.title}</div>
                    {n.title_ar && <div className="text-xs text-muted-foreground" dir="rtl">{n.title_ar}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                    {n.message}
                  </TableCell>
                  <TableCell>{typeBadge(n.type)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={t("notifications.form.title")}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              placeholder={t("notifications.form.titleAr")}
              value={form.title_ar}
              onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
              dir="rtl"
            />
            <Textarea
              placeholder={t("notifications.form.message")}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={3}
            />
            <Textarea
              placeholder={t("notifications.form.messageAr")}
              value={form.message_ar}
              onChange={(e) => setForm({ ...form, message_ar: e.target.value })}
              rows={3}
              dir="rtl"
            />
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              <Send className="w-4 h-4" />
              {sending ? "Sending..." : "Send to All Users"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default NotificationsSection;
