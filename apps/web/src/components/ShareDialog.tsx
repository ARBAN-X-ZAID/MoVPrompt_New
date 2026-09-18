import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { createSharedPrompt, type CreateSharePayload } from "@/lib/sharePrompt";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  payload: CreateSharePayload | null;
}

export const ShareDialog = ({ open, onOpenChange, payload }: ShareDialogProps) => {
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  

  // Reset when dialog opens with a fresh payload.
  const handleOpen = (next: boolean) => {
    if (!next) {
      setShareUrl(null);
      setCopied(false);
    }
    onOpenChange(next);
  };

  const handleCreate = async () => {
    if (!payload) return;
    setCreating(true);
    try {
      const { url } = await createSharedPrompt(payload);
      setShareUrl(url);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not create share link");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1800);
  };

  const tweetHref = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        "I just generated cinematic video prompts with MovPrompt 🎬",
      )}&url=${encodeURIComponent(shareUrl)}`
    : "#";

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Share these prompts
          </DialogTitle>
          <DialogDescription>
            Create a public, read-only page that anyone can open — no sign-in required.
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <div>• Visitors see all shots, model badges, and copy-to-clipboard buttons.</div>
              <div>• Uploaded images are <span className="text-foreground">not</span> shared.</div>
              <div>• You can revoke the link anytime from this dialog.</div>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  Creating link…
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 me-2" />
                  Create share link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={handleCopy} variant="secondary" className="shrink-0">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">Open</a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a href={tweetHref} target="_blank" rel="noopener noreferrer">
                  <Share2 className="w-4 h-4 me-1.5" />
                  Tweet
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
