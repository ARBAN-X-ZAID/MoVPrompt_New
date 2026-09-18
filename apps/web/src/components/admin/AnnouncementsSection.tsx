import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  link_text: string | null;
  type: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

const AnnouncementsSection = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", title_ar: "", message: "", message_ar: "", type: "info", link_url: "", link_text: "", link_text_ar: "", starts_at: "", ends_at: "" });

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setAnnouncements(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const resetForm = () => {
    setForm({ title: "", title_ar: "", message: "", message_ar: "", type: "info", link_url: "", link_text: "", link_text_ar: "", starts_at: "", ends_at: "" });
    setEditId(null);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (a: any) => {
    setForm({
      title: a.title,
      title_ar: a.title_ar || "",
      message: a.message,
      message_ar: a.message_ar || "",
      type: a.type,
      link_url: a.link_url || "",
      link_text: a.link_text || "",
      link_text_ar: a.link_text_ar || "",
      starts_at: a.starts_at ? a.starts_at.split("T")[0] : "",
      ends_at: a.ends_at ? a.ends_at.split("T")[0] : "",
    });
    setEditId(a.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title,
      title_ar: form.title_ar || null,
      message: form.message,
      message_ar: form.message_ar || null,
      type: form.type,
      link_url: form.link_url || null,
      link_text: form.link_text || null,
      link_text_ar: form.link_text_ar || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };

    if (editId) {
      await supabase.from("announcements").update(payload).eq("id", editId);
      toast({ title: "Announcement updated" });
    } else {
      await supabase.from("announcements").insert(payload);
      toast({ title: "Announcement created" });
    }
    setDialogOpen(false);
    resetForm();
    fetchAnnouncements();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("announcements").update({ is_active: !current }).eq("id", id);
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    toast({ title: "Announcement deleted" });
    fetchAnnouncements();
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = { info: "default", warning: "secondary", promo: "outline" };
    return <Badge variant={colors[type] as any}>{type}</Badge>;
  };

  if (loading) return <p className="text-muted-foreground animate-pulse">Loading announcements...</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="w-5 h-5 text-primary" /> Announcements & Banners
        </CardTitle>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" /> New
        </Button>
      </CardHeader>
      <CardContent>
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No announcements yet. Create your first one!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{typeBadge(a.type)}</TableCell>
                  <TableCell>
                    <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a.id, a.is_active)} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.starts_at ? new Date(a.starts_at).toLocaleDateString() : "—"} → {a.ends_at ? new Date(a.ends_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-end space-x-1 rtl:space-x-reverse">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <DialogTitle>{editId ? "Edit" : "New"} Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Title (English)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Title (Arabic)" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} dir="rtl" />
            <Textarea placeholder="Message (English)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <Textarea placeholder="Message (Arabic)" value={form.message_ar} onChange={(e) => setForm({ ...form, message_ar: e.target.value })} dir="rtl" />
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="promo">Promo</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="CTA URL" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
              <Input placeholder="CTA Text (EN)" value={form.link_text} onChange={(e) => setForm({ ...form, link_text: e.target.value })} />
              <Input placeholder="CTA Text (AR)" value={form.link_text_ar} onChange={(e) => setForm({ ...form, link_text_ar: e.target.value })} dir="rtl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Starts</label>
                <Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ends</label>
                <Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editId ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AnnouncementsSection;
