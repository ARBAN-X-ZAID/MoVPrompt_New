import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TypographyVibe =
  | "modern-sans"
  | "editorial-serif"
  | "bold-display"
  | "handwritten"
  | "monospace";

export const TYPOGRAPHY_VIBES: { id: TypographyVibe; label: string; hint: string; sample: string; fontFamily: string }[] = [
  { id: "modern-sans", label: "Modern sans", hint: "Clean, geometric", sample: "Aa", fontFamily: "'Inter', 'Helvetica Neue', sans-serif" },
  { id: "editorial-serif", label: "Editorial serif", hint: "Magazine-grade", sample: "Aa", fontFamily: "'Playfair Display', Georgia, serif" },
  { id: "bold-display", label: "Bold display", hint: "Heavy, condensed", sample: "Aa", fontFamily: "'Bebas Neue', Impact, sans-serif" },
  { id: "handwritten", label: "Handwritten", hint: "Casual, organic", sample: "Aa", fontFamily: "'Caveat', 'Brush Script MT', cursive" },
  { id: "monospace", label: "Monospace", hint: "Technical, code-like", sample: "Aa", fontFamily: "'JetBrains Mono', 'Courier New', monospace" },
];

export type LightingStyle = "natural" | "soft-studio" | "hard-contrast" | "golden-hour" | "neon-night" | "overcast";
export type FinishVibe = "premium-glass" | "matte-minimal" | "organic-warm" | "industrial-raw" | "playful-pop" | "retro-film";
export type Pacing = "slow-elegant" | "balanced" | "punchy-fast";
export type LogoTreatment = "none" | "subtle-watermark" | "end-card-reveal" | "hero-product";

export const LIGHTING_STYLES: { id: LightingStyle; label: string; hint: string }[] = [
  { id: "natural", label: "Natural", hint: "Window / daylight" },
  { id: "soft-studio", label: "Soft studio", hint: "Diffused, even" },
  { id: "hard-contrast", label: "Hard contrast", hint: "Sharp shadows" },
  { id: "golden-hour", label: "Golden hour", hint: "Warm low sun" },
  { id: "neon-night", label: "Neon night", hint: "Color-lit dark" },
  { id: "overcast", label: "Overcast", hint: "Flat, moody" },
];
export const FINISH_VIBES: { id: FinishVibe; label: string; hint: string }[] = [
  { id: "premium-glass", label: "Premium glass", hint: "Glossy, reflective" },
  { id: "matte-minimal", label: "Matte minimal", hint: "Soft, restrained" },
  { id: "organic-warm", label: "Organic warm", hint: "Natural materials" },
  { id: "industrial-raw", label: "Industrial raw", hint: "Concrete, steel" },
  { id: "playful-pop", label: "Playful pop", hint: "Bright, candy" },
  { id: "retro-film", label: "Retro film", hint: "Grainy, analog" },
];
export const PACING_OPTIONS: { id: Pacing; label: string; hint: string }[] = [
  { id: "slow-elegant", label: "Slow & elegant", hint: "Long takes" },
  { id: "balanced", label: "Balanced", hint: "Mixed rhythm" },
  { id: "punchy-fast", label: "Punchy & fast", hint: "Quick cuts" },
];
export const LOGO_TREATMENTS: { id: LogoTreatment; label: string; hint: string }[] = [
  { id: "none", label: "None", hint: "No logo on screen" },
  { id: "subtle-watermark", label: "Subtle watermark", hint: "Corner mark" },
  { id: "end-card-reveal", label: "End-card reveal", hint: "Final beat" },
  { id: "hero-product", label: "Hero placement", hint: "On packaging" },
];

export type BrandIdentity = {
  id?: string;
  logo_path: string | null;
  logo_url?: string | null;
  primary_color: string | null;
  supporting_colors: string[] | null;
  avoid_colors: string[] | null;
  typography_vibe: TypographyVibe | null;
  font_hint: string | null;
  mood_notes: string | null;
  tagline: string | null;
  lighting_style: LightingStyle | null;
  finish_vibe: FinishVibe | null;
  pacing: Pacing | null;
  logo_treatment: LogoTreatment | null;
  brand_voice: string | null;
  industry: string | null;
};

export const EMPTY_BRAND_IDENTITY: BrandIdentity = {
  logo_path: null,
  logo_url: null,
  primary_color: null,
  supporting_colors: null,
  avoid_colors: null,
  typography_vibe: null,
  font_hint: null,
  mood_notes: null,
  tagline: null,
  lighting_style: null,
  finish_vibe: null,
  pacing: null,
  logo_treatment: null,
  brand_voice: null,
  industry: null,
};

async function signLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("director-uploads")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export function hasBrandIdentity(b: BrandIdentity | null | undefined): boolean {
  if (!b) return false;
  return !!(
    b.primary_color ||
    (b.supporting_colors && b.supporting_colors.length > 0)
  );
}

// Module-level shared store so all consumers (chip + sheet) see the same state.
let currentIdentity: BrandIdentity | null = null;
let currentLoading = true;
let currentUserId: string | null | undefined = undefined;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function loadFor(userId: string | null): Promise<void> {
  currentUserId = userId;
  currentLoading = true;
  emit();
  if (!userId) {
    currentIdentity = null;
    currentLoading = false;
    emit();
    return;
  }
  const { data } = await supabase
    .from("brand_identities")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    const row = data as any;
    const logo_url = await signLogo(row.logo_path);
    currentIdentity = {
      id: row.id,
      logo_path: row.logo_path,
      logo_url,
      primary_color: row.primary_color,
      supporting_colors: row.supporting_colors ?? null,
      avoid_colors: row.avoid_colors ?? null,
      typography_vibe: row.typography_vibe,
      font_hint: row.font_hint,
      mood_notes: row.mood_notes,
      tagline: row.tagline,
      lighting_style: row.lighting_style ?? null,
      finish_vibe: row.finish_vibe ?? null,
      pacing: row.pacing ?? null,
      logo_treatment: row.logo_treatment ?? null,
      brand_voice: row.brand_voice ?? null,
      industry: row.industry ?? null,
    };
  } else {
    currentIdentity = null;
  }
  currentLoading = false;
  emit();
}

function ensureLoaded(userId: string | null) {
  if (currentUserId === userId) return;
  inflight = loadFor(userId);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useBrandIdentity() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const identity = useSyncExternalStore(
    subscribe,
    () => currentIdentity,
    () => currentIdentity,
  );
  const loading = useSyncExternalStore(
    subscribe,
    () => currentLoading,
    () => currentLoading,
  );

  useEffect(() => {
    ensureLoaded(userId);
  }, [userId]);

  const reload = useCallback(async () => {
    await loadFor(userId);
  }, [userId]);

  const save = useCallback(
    async (next: BrandIdentity) => {
      if (!userId) throw new Error("Not signed in");
      const payload = {
        user_id: userId,
        logo_path: next.logo_path,
        primary_color: next.primary_color,
        supporting_colors: next.supporting_colors,
        avoid_colors: next.avoid_colors,
        typography_vibe: next.typography_vibe,
        font_hint: next.font_hint,
        mood_notes: next.mood_notes,
        tagline: next.tagline,
        lighting_style: next.lighting_style,
        finish_vibe: next.finish_vibe,
        pacing: next.pacing,
        logo_treatment: next.logo_treatment,
        brand_voice: next.brand_voice,
        industry: next.industry,
      };
      const { error } = await supabase
        .from("brand_identities")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      await loadFor(userId);
    },
    [userId],
  );

  const clear = useCallback(async () => {
    if (!userId) return;
    await supabase.from("brand_identities").delete().eq("user_id", userId);
    await loadFor(userId);
  }, [userId]);

  const uploadLogo = useCallback(
    async (file: File) => {
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "png";
      const path = `marketing/${userId}/identity/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("director-uploads")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      return path;
    },
    [userId],
  );

  return { identity, loading, save, clear, uploadLogo, reload };
}

