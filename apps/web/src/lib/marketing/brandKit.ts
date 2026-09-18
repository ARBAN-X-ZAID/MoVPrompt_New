import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Subject } from "@/lib/marketingStudio";

export type ProductReferenceKind = "angle" | "spec_sheet";

export type ProductReference = {
  id: string;
  brand_kit_id: string;
  kind: ProductReferenceKind;
  image_path: string;
  /** Signed URL for previewing (not persisted). */
  image_url?: string | null;
  label: string | null;
  position: number;
};

export type BrandKit = {
  id?: string;
  subject: Subject;
  name: string;
  description: string;
  url: string | null;
  tagline: string | null;
  audience: string | null;
  logo_path: string | null;
  /** Signed URL for previewing logo (not persisted). */
  logo_url?: string | null;
  /** Product fact sheet — filled by AI on upload, editable by user. */
  category: string | null;
  visual_parts: string | null;
  materials: string | null;
  hero_colors: string[] | null;
  packaging: string | null;
  /** Extra product references (angle photos + optional spec sheet). */
  references?: ProductReference[];
  updated_at?: string;
};

export const EMPTY_BRAND_KIT: BrandKit = {
  subject: "product",
  name: "",
  description: "",
  url: null,
  tagline: null,
  audience: null,
  logo_path: null,
  logo_url: null,
  category: null,
  visual_parts: null,
  materials: null,
  hero_colors: null,
  packaging: null,
  references: [],
};

export const MAX_BRAND_ANGLES = 5;

export const MAX_BRANDS = 2;

async function signLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("director-uploads")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export function useBrandKit() {
  const { user } = useAuth();
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [activeIds, setActiveIdsState] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setKits([]);
      setActiveIdsState([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: rows }, { data: sel }, { data: refRows }] = await Promise.all([
      supabase
        .from("brand_kits")
        .select("id,subject,name,description,url,tagline,audience,logo_path,category,visual_parts,materials,hero_colors,packaging,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("brand_kit_selections")
        .select("brand_kit_id,position")
        .eq("user_id", user.id)
        .order("position", { ascending: true }),
      supabase
        .from("product_references")
        .select("id,brand_kit_id,kind,image_path,label,position")
        .eq("user_id", user.id)
        .order("position", { ascending: true }),
    ]);
    const list = (rows ?? []) as BrandKit[];
    const refsByKit: Record<string, ProductReference[]> = {};
    for (const r of (refRows ?? []) as ProductReference[]) {
      const signedUrl = await signLogo(r.image_path);
      (refsByKit[r.brand_kit_id] ||= []).push({ ...r, image_url: signedUrl });
    }
    const signed = await Promise.all(
      list.map(async (k) => ({
        ...k,
        logo_url: await signLogo(k.logo_path),
        references: k.id ? refsByKit[k.id] ?? [] : [],
      })),
    );
    setKits(signed);
    const ids = (sel ?? [])
      .map((r) => r.brand_kit_id as string | null)
      .filter((id): id is string => !!id && signed.some((k) => k.id === id))
      .slice(0, MAX_BRANDS);
    setActiveIdsState(ids);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeKits = activeIds
    .map((id) => kits.find((k) => k.id === id))
    .filter((k): k is BrandKit => !!k);
  const activeKit = activeKits[0] ?? null;
  const activeId = activeIds[0] ?? null;

  const persistSelections = useCallback(
    async (ids: string[]) => {
      if (!user) return;
      await supabase.from("brand_kit_selections").delete().eq("user_id", user.id);
      if (ids.length > 0) {
        await supabase.from("brand_kit_selections").insert(
          ids.map((id, i) => ({
            user_id: user.id,
            brand_kit_id: id,
            position: i,
            updated_at: new Date().toISOString(),
          })),
        );
      }
    },
    [user],
  );

  const setActiveIds = useCallback(
    async (ids: string[]) => {
      const capped = ids.slice(0, MAX_BRANDS);
      setActiveIdsState(capped);
      await persistSelections(capped);
    },
    [persistSelections],
  );

  const toggleActive = useCallback(
    async (id: string) => {
      const next = activeIds.includes(id)
        ? activeIds.filter((x) => x !== id)
        : activeIds.length >= MAX_BRANDS
          ? activeIds
          : [...activeIds, id];
      await setActiveIds(next);
    },
    [activeIds, setActiveIds],
  );

  const setActive = useCallback(
    async (id: string | null) => {
      await setActiveIds(id ? [id] : []);
    },
    [setActiveIds],
  );

  const saveKit = useCallback(
    async (next: BrandKit): Promise<BrandKit> => {
      if (!user) throw new Error("Not signed in");
      const payload = {
        user_id: user.id,
        subject: next.subject,
        name: next.name,
        description: next.description,
        url: next.url,
        tagline: next.tagline,
        audience: next.audience,
        logo_path: next.logo_path,
        category: next.category,
        visual_parts: next.visual_parts,
        materials: next.materials,
        hero_colors: next.hero_colors,
        packaging: next.packaging,
      };
      if (!next.id && !payload.logo_path && next.logo_url) {
        console.warn(
          "[brandKit] saving a new brand with no logo_path but a local logo_url — the uploaded image was lost before save",
        );
      }
      let saved: BrandKit;
      if (next.id) {
        const { data, error } = await supabase
          .from("brand_kits")
          .update(payload)
          .eq("id", next.id)
          .select("id,subject,name,description,url,tagline,audience,logo_path,category,visual_parts,materials,hero_colors,packaging,updated_at")
          .single();
        if (error) throw error;
        saved = data as BrandKit;
      } else {
        const { data, error } = await supabase
          .from("brand_kits")
          .insert(payload)
          .select("id,subject,name,description,url,tagline,audience,logo_path,category,visual_parts,materials,hero_colors,packaging,updated_at")
          .single();
        if (error) throw error;
        saved = data as BrandKit;
      }
      saved.logo_url = await signLogo(saved.logo_path);
      await reload();
      if (saved.id) {
        // Use functional updater so we don't depend on a stale activeIds
        // closure (reload() just queued its own setActiveIdsState).
        let nextIds: string[] = [];
        setActiveIdsState((prev) => {
          if (prev.includes(saved.id!)) {
            nextIds = prev;
            return prev;
          }
          nextIds = [...prev, saved.id!].slice(0, MAX_BRANDS);
          return nextIds;
        });
        await persistSelections(nextIds);
      }
      return saved;
    },
    [user, reload, persistSelections],
  );

  const deleteKit = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("brand_kits").delete().eq("id", id);
      if (error) throw error;
      if (activeIds.includes(id)) {
        await setActiveIds(activeIds.filter((x) => x !== id));
      }
      await reload();
    },
    [user, activeIds, reload, setActiveIds],
  );

  const uploadLogo = useCallback(
    async (file: File) => {
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "png";
      const path = `marketing/${user.id}/brand/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("director-uploads")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      return path;
    },
    [user],
  );

  const uploadLocationImage = useCallback(
    async (file: File) => {
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "png";
      const path = `marketing/${user.id}/location/img-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("director-uploads")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("director-uploads")
        .createSignedUrl(path, 60 * 60);
      return { path, url: data?.signedUrl ?? null };
    },
    [user],
  );

  const addReference = useCallback(
    async (
      brand_kit_id: string,
      file: File,
      kind: ProductReferenceKind,
      label: string | null,
    ): Promise<ProductReference> => {
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "png";
      const path = `marketing/${user.id}/brand-references/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("director-uploads")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const existing = kits.find((k) => k.id === brand_kit_id)?.references ?? [];
      const position = existing.length;
      const { data, error } = await supabase
        .from("product_references")
        .insert({
          brand_kit_id,
          user_id: user.id,
          kind,
          image_path: path,
          label,
          position,
        })
        .select("id,brand_kit_id,kind,image_path,label,position")
        .single();
      if (error) throw error;
      const ref = data as ProductReference;
      ref.image_url = await signLogo(ref.image_path);
      await reload();
      return ref;
    },
    [user, kits, reload],
  );

  /** Persist an already-uploaded image as a brand reference (no re-upload). */
  const addReferenceFromPath = useCallback(
    async (
      brand_kit_id: string,
      image_path: string,
      kind: ProductReferenceKind,
      label: string | null,
    ): Promise<ProductReference> => {
      if (!user) throw new Error("Not signed in");
      const existing = kits.find((k) => k.id === brand_kit_id)?.references ?? [];
      const position = existing.length;
      const { data, error } = await supabase
        .from("product_references")
        .insert({
          brand_kit_id,
          user_id: user.id,
          kind,
          image_path,
          label,
          position,
        })
        .select("id,brand_kit_id,kind,image_path,label,position")
        .single();
      if (error) throw error;
      const ref = data as ProductReference;
      ref.image_url = await signLogo(ref.image_path);
      await reload();
      return ref;
    },
    [user, kits, reload],
  );

  const updateReferenceLabel = useCallback(
    async (id: string, label: string | null) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("product_references")
        .update({ label })
        .eq("id", id);
      if (error) throw error;
      await reload();
    },
    [user, reload],
  );

  const removeReference = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("product_references")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await reload();
    },
    [user, reload],
  );

  return {
    kits,
    activeKit,
    activeKits,
    activeId,
    activeIds,
    loading,
    setActive,
    setActiveIds,
    toggleActive,
    saveKit,
    deleteKit,
    uploadLogo,
    uploadLocationImage,
    addReference,
    addReferenceFromPath,
    updateReferenceLabel,
    removeReference,
    reload,
  };
}

export type BrandImageAnalysis = {
  name: string | null;
  description: string | null;
  tagline: string | null;
  category: string | null;
  visual_parts: string | null;
  materials: string | null;
  hero_colors: string[] | null;
  packaging: string | null;
};

export async function analyzeBrandImage(input: {
  imagePath?: string | null;
  imageUrl?: string | null;
  subject: Subject;
}): Promise<BrandImageAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-brand-image", {
    body: input,
  });
  if (error) throw error;
  return data as BrandImageAnalysis;
}

export type LocationInput = {
  place: string;
  imagePath: string | null;
  imageUrl: string | null;
};

export const EMPTY_LOCATION: LocationInput = {
  place: "",
  imagePath: null,
  imageUrl: null,
};
