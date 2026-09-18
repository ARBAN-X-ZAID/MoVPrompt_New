import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CharacterShotType = "face" | "full";

export type CharacterKit = {
  id?: string;
  name: string;
  description: string;
  role: string | null;
  reference_path: string | null;
  /** Whether the reference image is a face/headshot or a full head-to-toe look. */
  shot_type: CharacterShotType;
  /** Signed URL for previewing reference image (not persisted). */
  reference_url?: string | null;
  updated_at?: string;
};

export const EMPTY_CHARACTER_KIT: CharacterKit = {
  name: "",
  description: "",
  role: null,
  reference_path: null,
  shot_type: "face",
  reference_url: null,
};


export const MAX_CHARACTERS = 3;

async function signRef(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("director-uploads")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export function useCharacterKit() {
  const { user } = useAuth();
  const [kits, setKits] = useState<CharacterKit[]>([]);
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
    const [{ data: rows }, { data: sel }] = await Promise.all([
      supabase
        .from("character_kits")
        .select("id,name,description,role,reference_path,shot_type,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("character_kit_selections")
        .select("character_kit_id,position")
        .eq("user_id", user.id)
        .order("position", { ascending: true }),
    ]);

    const list = (rows ?? []) as CharacterKit[];
    const signed = await Promise.all(
      list.map(async (k) => ({ ...k, reference_url: await signRef(k.reference_path) })),
    );
    setKits(signed);
    const ids = (sel ?? [])
      .map((r) => r.character_kit_id as string | null)
      .filter((id): id is string => !!id && signed.some((k) => k.id === id))
      .slice(0, MAX_CHARACTERS);
    setActiveIdsState(ids);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeKits = activeIds
    .map((id) => kits.find((k) => k.id === id))
    .filter((k): k is CharacterKit => !!k);
  const activeKit = activeKits[0] ?? null;
  const activeId = activeIds[0] ?? null;

  const persistSelections = useCallback(
    async (ids: string[]) => {
      if (!user) return;
      await supabase.from("character_kit_selections").delete().eq("user_id", user.id);
      if (ids.length > 0) {
        await supabase.from("character_kit_selections").insert(
          ids.map((id, i) => ({
            user_id: user.id,
            character_kit_id: id,
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
      const capped = ids.slice(0, MAX_CHARACTERS);
      setActiveIdsState(capped);
      await persistSelections(capped);
    },
    [persistSelections],
  );

  const toggleActive = useCallback(
    async (id: string) => {
      const next = activeIds.includes(id)
        ? activeIds.filter((x) => x !== id)
        : activeIds.length >= MAX_CHARACTERS
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
    async (next: CharacterKit): Promise<CharacterKit> => {
      if (!user) throw new Error("Not signed in");
      const payload = {
        user_id: user.id,
        name: next.name,
        description: next.description,
        role: next.role,
        reference_path: next.reference_path,
        shot_type: next.shot_type ?? "face",
      };
      if (!next.id && !payload.reference_path && next.reference_url) {
        console.warn(
          "[characterKit] saving a new character with no reference_path but a local reference_url — the uploaded image was lost before save",
        );
      }
      let saved: CharacterKit;
      if (next.id) {
        const { data, error } = await supabase
          .from("character_kits")
          .update(payload)
          .eq("id", next.id)
          .select("id,name,description,role,reference_path,shot_type,updated_at")
          .single();
        if (error) throw error;
        saved = data as CharacterKit;
      } else {
        const { data, error } = await supabase
          .from("character_kits")
          .insert(payload)
          .select("id,name,description,role,reference_path,shot_type,updated_at")
          .single();
        if (error) throw error;
        saved = data as CharacterKit;
      }

      saved.reference_url = await signRef(saved.reference_path);
      await reload();
      if (saved.id) {
        let nextIds: string[] = [];
        setActiveIdsState((prev) => {
          if (prev.includes(saved.id!)) {
            nextIds = prev;
            return prev;
          }
          nextIds = [...prev, saved.id!].slice(0, MAX_CHARACTERS);
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
      const { error } = await supabase.from("character_kits").delete().eq("id", id);
      if (error) throw error;
      if (activeIds.includes(id)) {
        await setActiveIds(activeIds.filter((x) => x !== id));
      }
      await reload();
    },
    [user, activeIds, reload, setActiveIds],
  );

  const uploadReference = useCallback(
    async (file: File) => {
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "png";
      const path = `marketing/${user.id}/character/ref-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("director-uploads")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      return path;
    },
    [user],
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
    uploadReference,
    reload,
  };
}

export type CharacterImageAnalysis = {
  name: string | null;
  role: string | null;
  description: string | null;
};

export async function analyzeCharacterImage(input: {
  imagePath?: string | null;
  imageUrl?: string | null;
  shotType?: CharacterShotType;
}): Promise<CharacterImageAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-character-image", {
    body: input,
  });
  if (error) throw error;
  return data as CharacterImageAnalysis;
}

