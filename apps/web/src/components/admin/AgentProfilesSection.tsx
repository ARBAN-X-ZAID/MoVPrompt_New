import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Bot, Pencil } from "lucide-react";

interface AgentProfile {
  id: string;
  agent_id: string;
  display_name: string;
  doc_summary: string;
  system_addendum: string;
  examples: string;
  is_active: boolean;
  updated_at: string;
}

const AgentProfilesSection = () => {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AgentProfile | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    doc_summary: "",
    system_addendum: "",
    examples: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchAgents = async () => {
    const { data, error } = await supabase
      .from("agent_profiles")
      .select("*")
      .order("agent_id");
    if (error) {
      toast({ title: "Failed to load agents", description: error.message, variant: "destructive" });
    }
    setAgents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const openEdit = (agent: AgentProfile) => {
    setEditing(agent);
    setForm({
      display_name: agent.display_name,
      doc_summary: agent.doc_summary,
      system_addendum: agent.system_addendum,
      examples: agent.examples,
      is_active: agent.is_active,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.display_name.trim()) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("agent_profiles")
      .update({
        display_name: form.display_name,
        doc_summary: form.doc_summary,
        system_addendum: form.system_addendum,
        examples: form.examples,
        is_active: form.is_active,
        updated_by: userData.user?.id ?? null,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Agent updated", description: "Changes will apply to new generations within ~60s." });
    setEditing(null);
    fetchAgents();
  };

  const toggleActive = async (agent: AgentProfile) => {
    const { error } = await supabase
      .from("agent_profiles")
      .update({ is_active: !agent.is_active })
      .eq("id", agent.id);
    if (error) {
      toast({ title: "Toggle failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchAgents();
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading agents…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Agent Profiles
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Edit prompt content sent to the AI for each specialist. Changes apply to new generations within ~60 seconds (no redeploy needed). Empty fields fall back to in-code defaults.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.display_name}</TableCell>
                <TableCell>
                  <code className="text-xs text-muted-foreground">{a.agent_id}</code>
                </TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(a)} className="cursor-pointer">
                    <Badge variant={a.is_active ? "default" : "secondary"}>
                      {a.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(a.updated_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)} className="gap-1">
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit {editing?.display_name}</DialogTitle>
              <DialogDescription>
                Agent ID: <code className="text-xs">{editing?.agent_id}</code> — used by the routing
                registry. Cannot be changed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(c) => setForm({ ...form, is_active: c })}
                />
                <Label>Active (when off, requests fall back to in-code defaults)</Label>
              </div>

              <div className="space-y-2">
                <Label>
                  Doc Summary{" "}
                  <span className="text-xs text-muted-foreground">
                    ({form.doc_summary.length} chars)
                  </span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Distilled documentation about the target model — capabilities, syntax, optimal length.
                </p>
                <Textarea
                  value={form.doc_summary}
                  onChange={(e) => setForm({ ...form, doc_summary: e.target.value })}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder="Leave empty to use in-code default…"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  System Addendum{" "}
                  <span className="text-xs text-muted-foreground">
                    ({form.system_addendum.length} chars)
                  </span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Strict rules for output format, fields to populate, and model-specific negatives.
                </p>
                <Textarea
                  value={form.system_addendum}
                  onChange={(e) => setForm({ ...form, system_addendum: e.target.value })}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder="Leave empty to use in-code default…"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Examples{" "}
                  <span className="text-xs text-muted-foreground">
                    ({form.examples.length} chars)
                  </span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Few-shot examples showing the AI exactly the output style you want.
                </p>
                <Textarea
                  value={form.examples}
                  onChange={(e) => setForm({ ...form, examples: e.target.value })}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder="Leave empty to use in-code default…"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AgentProfilesSection;
