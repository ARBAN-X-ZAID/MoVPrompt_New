import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, X, Loader2 } from "lucide-react";

interface WelcomePopup {
  id: string;
  title: string;
  title_ar: string | null;
  message: string;
  message_ar: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  link_text_ar: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  title: "", title_ar: "", message: "", message_ar: "",
  image_url: "", link_url: "", link_text: "", link_text_ar: "",
};

const BUCKET = "welcome-popup-media";

const WelcomePopupSection = () => {
  const [popups, setPopups] = useState<WelcomePopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetch_ = async () => {
    const { data } = await supabase.from("welcome_popups").select("*").order("created_at", { ascending: false });
    setPopups((data as WelcomePopup[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: WelcomePopup) => {
    setEditingId(p.id);
    setForm({
      title: p.title, title_ar: p.title_ar || "", message: p.message, message_ar: p.message_ar || "",
      image_url: p.image_url || "", link_url: p.link_url || "", link_text: p.link_text || "", link_text_ar: p.link_text_ar || "",
    });
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast({ title: "Only image and video files are allowed", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File must be under 20MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    setForm((prev) => ({ ...prev, image_url: urlData.publicUrl }));
    toast({ title: "File uploaded" });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearMedia = () => {
    setForm((prev) => ({ ...prev, image_url: "" }));
  };

  const handleSave = async () => {
    if (!form.title || !form.message) { toast({ title: "Title and message are required" }); return; }
    const payload = {
      title: form.title, title_ar: form.title_ar || null, message: form.message, message_ar: form.message_ar || null,
      image_url: form.image_url || null, link_url: form.link_url || null, link_text: form.link_text || null, link_text_ar: form.link_text_ar || null,
    };
    if (editingId) {
      await supabase.from("welcome_popups").update(payload).eq("id", editingId);
    } else {
      await supabase.from("welcome_popups").insert(payload);
    }
    toast({ title: editingId ? "Popup updated" : "Popup created" });
    setDialogOpen(false);
    fetch_();
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!current) {
      await supabase.from("welcome_popups").update({ is_active: false }).neq("id", id);
    }
    await supabase.from("welcome_popups").update({ is_active: !current }).eq("id", id);
    fetch_();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("welcome_popups").delete().eq("id", id);
    toast({ title: "Popup deleted" });
    fetch_();
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const isVideo = form.image_url && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(form.image_url);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Welcome Popup</CardTitle>
        <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> New Popup</Button>
      </CardHeader>
      <CardContent>
        {popups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No welcome popups configured</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {popups.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p.id, p.is_active)} />
                  </TableCell>
                  <TableCell className="text-end space-x-2 rtl:space-x-reverse">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Popup" : "New Popup"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title (English)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Title (Arabic)" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} dir="rtl" />
            <Textarea placeholder="Message (English)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <Textarea placeholder="Message (Arabic)" value={form.message_ar} onChange={(e) => setForm({ ...form, message_ar: e.target.value })} dir="rtl" />

            {/* Media upload section */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Image or Video (optional)</label>
              {form.image_url ? (
                <div className="relative rounded-md border border-border overflow-hidden">
                  {isVideo ? (
                    <video src={form.image_url} className="w-full max-h-40 object-cover" controls muted />
                  ) : (
                    <img src={form.image_url} alt="Preview" className="w-full max-h-40 object-cover" />
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 end-2 w-6 h-6"
                    onClick={clearMedia}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Click to upload image or video</span>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-[10px] text-muted-foreground">Or paste a URL below:</p>
              <Input
                placeholder="https://..."
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>

            <Input placeholder="Link URL (optional)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
            <Input placeholder="Link Text (English)" value={form.link_text} onChange={(e) => setForm({ ...form, link_text: e.target.value })} />
            <Input placeholder="Link Text (Arabic)" value={form.link_text_ar} onChange={(e) => setForm({ ...form, link_text_ar: e.target.value })} dir="rtl" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={uploading}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default WelcomePopupSection;
