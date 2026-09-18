import { supabase } from "@/integrations/supabase/client";

export type EditMode = "prompt" | "paint" | "swap" | "erase";
export type EditQuality = "1K" | "2K" | "4K";

export type EditImageResult = {
  url: string;
  storage_path: string;
  edit: { mode: EditMode; prompt: string; parent_url: string };
  quality?: EditQuality;
};

/**
 * Calls the generate-reference-image edge function with op:"edit" to refine
 * an existing generated image — prompt-only, mask-based paint, subject swap,
 * or clean erase. Always returns a brand-new image; the original is untouched.
 */
export async function editImage(params: {
  sourceUrl: string;
  maskDataUrl?: string;
  mode: EditMode;
  prompt: string;
  aspectRatio?: string;
  quality?: EditQuality;
}): Promise<EditImageResult> {
  const { data, error } = await supabase.functions.invoke("generate-reference-image", {
    body: {
      op: "edit",
      source_url: params.sourceUrl,
      mask_url: params.maskDataUrl || undefined,
      edit_mode: params.mode,
      prompt: params.prompt || "",
      aspect_ratio: params.aspectRatio,
      quality: params.quality || "1K",
    },
  });
  if (error) throw new Error(error.message || "Image edit failed");
  const img = (data as any)?.images?.[0];
  if (!img?.url) throw new Error((data as any)?.error || "No image returned");
  return {
    url: img.url,
    storage_path: img.storage_path,
    edit: (data as any).edit,
    quality: (data as any).quality,
  };
}
