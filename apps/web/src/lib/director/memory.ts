// Stage 4: Unified memory façade for Director → Orchestrator.
//
// Today three independent stores hold the user's creative memory:
//   1. tasteProfile.ts        — likes / dislikes / chip boosts
//   2. brand_kits + selection — product / brand identity
//   3. character_kits + sel.  — recurring people / mascots
//
// This file is a thin read-only API that loads all three (plus a tail of
// recent shots) in a single call, so every expert agent and the router can
// see the same memory snapshot without each one re-implementing the queries.
//
// Pure data layer — no React, no hooks. Safe to import from anywhere.

import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_TASTE_PROFILE,
  loadTasteProfile,
  type TasteProfile,
} from "@/lib/director/tasteProfile";
import type { BrandKit } from "@/lib/marketing/brandKit";
import type { CharacterKit } from "@/lib/marketing/characterKit";
import type { TasteSignals } from "@/lib/director/router";

export type RecentShot = {
  id: string;
  prompt: string;
  provider: string;
  liked: boolean;
  created_at: string;
};

export type DirectorMemory = {
  userId: string | null;
  sessionId: string | null;
  taste: TasteProfile;
  brands: BrandKit[];
  characters: CharacterKit[];
  recentShots: RecentShot[];
};

export const EMPTY_MEMORY: DirectorMemory = {
  userId: null,
  sessionId: null,
  taste: EMPTY_TASTE_PROFILE,
  brands: [],
  characters: [],
  recentShots: [],
};

/**
 * Load the full Director memory snapshot for the current (or given) user.
 *
 * Designed for the orchestrator + expert agents — every call site can pull
 * the same context without re-implementing the queries. All four sub-loads
 * fire in parallel.
 */
export async function loadMemoryFor(
  sessionId?: string | null,
  userIdOverride?: string | null,
): Promise<DirectorMemory> {
  let userId = userIdOverride ?? null;
  if (!userId) {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) {
    return { ...EMPTY_MEMORY, sessionId: sessionId ?? null };
  }

  const [taste, brands, characters, recentShots] = await Promise.all([
    loadTasteProfile(userId),
    loadSelectedBrands(userId),
    loadSelectedCharacters(userId),
    loadRecentShots(userId),
  ]);

  return {
    userId,
    sessionId: sessionId ?? null,
    taste,
    brands,
    characters,
    recentShots,
  };
}

/** Derive routing taste signals from the unified memory. */
export function tasteSignalsFor(memory: DirectorMemory): TasteSignals {
  const preferred = new Set<string>();
  const avoid = new Set<string>();
  for (const shot of memory.recentShots) {
    if (shot.liked) preferred.add(shot.provider);
  }
  // Verbosity / chipReliance aren't model signals — leave them to prompt
  // generation. Router only cares about per-model preference.
  return {
    preferredModelIds: Array.from(preferred),
    avoidModelIds: Array.from(avoid),
  };
}

// ---------- internal loaders ----------

async function loadSelectedBrands(userId: string): Promise<BrandKit[]> {
  // Pull the user's brand kit selection (ordered) and hydrate each kit row.
  const { data: sel } = await supabase
    .from("brand_kit_selections")
    .select("brand_kit_id, position")
    .eq("user_id", userId)
    .order("position", { ascending: true });

  const ids = (sel ?? [])
    .map((r) => r.brand_kit_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return [];

  const { data: kits } = await supabase
    .from("brand_kits")
    .select(
      "id, subject, name, description, url, tagline, audience, logo_path, category, visual_parts, materials, hero_colors, packaging, updated_at",
    )
    .in("id", ids);

  const byId = new Map((kits ?? []).map((k) => [k.id, k] as const));
  return ids
    .map((id) => byId.get(id))
    .filter((k): k is NonNullable<typeof k> => !!k)
    .map(
      (k) =>
        ({
          id: k.id,
          subject: (k.subject as BrandKit["subject"]) ?? "product",
          name: k.name ?? "",
          description: k.description ?? "",
          url: k.url ?? null,
          tagline: k.tagline ?? null,
          audience: k.audience ?? null,
          logo_path: k.logo_path ?? null,
          category: k.category ?? null,
          visual_parts: k.visual_parts ?? null,
          materials: k.materials ?? null,
          hero_colors: Array.isArray(k.hero_colors)
            ? (k.hero_colors as string[])
            : null,
          packaging: k.packaging ?? null,
          updated_at: k.updated_at ?? undefined,
        }) satisfies BrandKit,
    );
}

async function loadSelectedCharacters(userId: string): Promise<CharacterKit[]> {
  const { data: sel } = await supabase
    .from("character_kit_selections")
    .select("character_kit_id, position")
    .eq("user_id", userId)
    .order("position", { ascending: true });

  const ids = (sel ?? [])
    .map((r) => r.character_kit_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return [];

  const { data: kits } = await supabase
    .from("character_kits")
    .select("id, name, description, role, reference_path, shot_type, updated_at")
    .in("id", ids);

  const byId = new Map((kits ?? []).map((k) => [k.id, k] as const));
  return ids
    .map((id) => byId.get(id))
    .filter((k): k is NonNullable<typeof k> => !!k)
    .map(
      (k) =>
        ({
          id: k.id,
          name: k.name ?? "",
          description: k.description ?? "",
          role: k.role ?? null,
          reference_path: k.reference_path ?? null,
          shot_type: (k.shot_type as CharacterKit["shot_type"]) ?? "face",
          updated_at: k.updated_at ?? undefined,
        }) satisfies CharacterKit,
    );
}

async function loadRecentShots(userId: string): Promise<RecentShot[]> {
  const { data } = await supabase
    .from("video_jobs")
    .select("id, prompt, provider, liked, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(12);
  return (data ?? []).map((r) => ({
    id: r.id,
    prompt: r.prompt ?? "",
    provider: r.provider ?? "",
    liked: !!r.liked,
    created_at: r.created_at,
  }));
}
