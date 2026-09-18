import {
  Camera, Move, MoveHorizontal, MoveVertical, ZoomIn, ZoomOut,
  RefreshCw, RotateCw, Crosshair, Sparkles, Flame, Snowflake,
  Droplets, Zap, Waves, Wind, Eye, Aperture, Hexagon, Star,
  Wand2, Cloud, Sun, CircleDot, Rewind, FastForward, Pause,
  ArrowUpRight, ArrowDownRight, Orbit, Plane,
  Radio, Music, Trophy, Shirt, Swords, Drama, Layers, GitMerge,
  Film, Heart, Gem, Bolt, Box,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Whitelist of lucide icons selectable when creating a custom preset. */
export const ICON_WHITELIST: Record<string, LucideIcon> = {
  Camera, Move, MoveHorizontal, MoveVertical, ZoomIn, ZoomOut,
  RefreshCw, RotateCw, Crosshair, Sparkles, Flame, Snowflake,
  Droplets, Zap, Waves, Wind, Eye, Aperture, Hexagon, Star,
  Wand2, Cloud, Sun, CircleDot, Rewind, FastForward, Pause,
  ArrowUpRight, ArrowDownRight, Orbit, Plane,
  Radio, Music, Trophy, Shirt, Swords, Drama, Layers, GitMerge,
  Film, Heart, Gem, Bolt, Box,
};

export const ICON_NAMES = Object.keys(ICON_WHITELIST);
export const getIconByName = (name: string): LucideIcon =>
  ICON_WHITELIST[name] ?? Camera;

export type PresetGroupId = "basic" | "epic" | "effects" | "pulse" | "mix";

export interface Preset {
  id: string;
  label: string;
  group: PresetGroupId;
  icon: LucideIcon;
  /** CSS class with a keyframe animation defined in index.css */
  animation: string;
  description: string;
  bestFor: string;
}

export interface PresetGroup {
  id: PresetGroupId;
  label: string;
  icon: string;
  description: string;
}

export const PRESET_GROUPS: PresetGroup[] = [
  { id: "basic", label: "Basic Camera", icon: "🎥", description: "Pans, tilts, zooms, and tracking moves." },
  { id: "epic", label: "Epic Camera", icon: "🎬", description: "Cranes, orbits, drones, and dramatic angles." },
  { id: "effects", label: "Effects", icon: "✨", description: "Materials, weather, motion, and artistic styles." },
  { id: "pulse", label: "Catch the Pulse", icon: "🔥", description: "Fashion, action, and stage moments." },
  { id: "mix", label: "Mix", icon: "🎭", description: "Two effects combined for unique results." },
];

const p = (
  id: string,
  label: string,
  group: PresetGroupId,
  icon: LucideIcon,
  animation: string,
  description: string,
  bestFor: string,
): Preset => ({ id, label, group, icon, animation, description, bestFor });

export const PRESETS: Preset[] = [
  // Basic Camera
  p("general", "General", "basic", Camera, "preset-pulse", "A balanced, neutral camera approach.", "Default starting point"),
  p("static", "Static", "basic", Camera, "", "Locked-off camera, no movement at all.", "Interviews, tableau shots"),
  p("no-movement", "No Movement", "basic", Camera, "", "Subject moves; the camera stays still.", "Studying performance"),
  p("natural", "Natural Movement", "basic", Camera, "preset-drift", "Subtle organic camera life.", "Documentary feel"),
  p("shake", "Shake", "basic", Camera, "preset-shake", "Sharp camera vibration for impact.", "Explosions, hits"),
  p("handheld", "Handheld", "basic", Camera, "preset-shake-soft", "Loose, human-held camera feel.", "Verité, action"),
  p("dolly-in", "Dolly In", "basic", ArrowUpRight, "preset-dolly-in", "Camera physically moves toward the subject.", "Tension, intimacy"),
  p("dolly-out", "Dolly Out", "basic", ArrowDownRight, "preset-dolly-out", "Camera pulls back from the subject.", "Reveals, release"),
  p("pan-left", "Pan Left", "basic", MoveHorizontal, "preset-pan-left", "Camera rotates horizontally to the left.", "Following motion"),
  p("pan-right", "Pan Right", "basic", MoveHorizontal, "preset-pan-right", "Camera rotates horizontally to the right.", "Following motion"),
  p("tilt-up", "Tilt Up", "basic", MoveVertical, "preset-tilt-up", "Camera angles upward from a fixed pivot.", "Reveals of height"),
  p("tilt-down", "Tilt Down", "basic", MoveVertical, "preset-tilt-down", "Camera angles downward from a fixed pivot.", "Looking down on subject"),
  p("zoom-in", "Zoom In", "basic", ZoomIn, "preset-zoom-in", "Lens focal length tightens onto subject.", "Emphasis"),
  p("zoom-out", "Zoom Out", "basic", ZoomOut, "preset-zoom-out", "Lens focal length widens away from subject.", "Context"),
  p("snap-zoom", "Snap Zoom", "basic", ZoomIn, "preset-snap-zoom", "Quick punch zoom for emphasis.", "Reactions, comedy"),
  p("tracking", "Tracking Shot", "basic", Move, "preset-pan-right", "Camera moves alongside the subject.", "Walks, runs"),
  p("follow", "Follow", "basic", Move, "preset-drift", "Camera follows subject from behind.", "POV-style movement"),
  p("push-in", "Push In", "basic", ArrowUpRight, "preset-dolly-in", "Slow, deliberate move toward the subject.", "Building tension"),
  p("pull-out", "Pull Out", "basic", ArrowDownRight, "preset-dolly-out", "Slow, deliberate move away from the subject.", "Emotional release"),
  p("pedestal-up", "Pedestal Up", "basic", MoveVertical, "preset-tilt-up", "Camera body rises straight up.", "Standing reveals"),
  p("pedestal-down", "Pedestal Down", "basic", MoveVertical, "preset-tilt-down", "Camera body lowers straight down.", "Sitting moments"),
  p("swivel", "Swivel", "basic", RotateCw, "preset-orbit", "Camera rotates on its own axis.", "Disorientation"),
  p("drift", "Drift", "basic", Wind, "preset-drift", "Slow, floaty horizontal glide.", "Dreamy moods"),
  p("reveal", "Reveal", "basic", Eye, "preset-dolly-out", "Movement uncovers something hidden.", "Surprises"),

  // Epic Camera
  p("dolly-zoom", "Dolly Zoom", "epic", Aperture, "preset-dolly-zoom", "Dolly one way while zooming the other — vertigo effect.", "Psychological tension"),
  p("dolly-zoom-in", "Dolly Zoom In", "epic", Aperture, "preset-dolly-zoom", "Push in while zooming out for compressed space.", "Hitchcock vertigo"),
  p("dolly-zoom-out", "Dolly Zoom Out", "epic", Aperture, "preset-dolly-zoom", "Pull back while zooming in — expanding world.", "Realization moments"),
  p("crash-zoom-in", "Crash Zoom In", "epic", ZoomIn, "preset-snap-zoom", "Aggressive, fast push to subject.", "Shock cuts"),
  p("crash-zoom-out", "Crash Zoom Out", "epic", ZoomOut, "preset-snap-zoom", "Aggressive, fast pull away.", "Sudden context"),
  p("arc-left", "Arc Left", "epic", Orbit, "preset-orbit", "Curving path around the subject to the left.", "Dynamic reveals"),
  p("arc-right", "Arc Right", "epic", Orbit, "preset-orbit-rev", "Curving path around the subject to the right.", "Dynamic reveals"),
  p("crane-up", "Crane Up", "epic", ArrowUpRight, "preset-tilt-up", "Camera rises on a crane while looking down.", "Epic reveals"),
  p("crane-down", "Crane Down", "epic", ArrowDownRight, "preset-tilt-down", "Camera lowers on a crane.", "Approaching subject"),
  p("fpv-drone", "FPV Drone", "epic", Plane, "preset-drift", "Aggressive, immersive drone movement.", "Action sequences"),
  p("orbit-left", "Orbit Left", "epic", Orbit, "preset-orbit", "Full circular motion around the subject.", "Hero shots"),
  p("orbit-right", "Orbit Right", "epic", Orbit, "preset-orbit-rev", "Full circular motion the other way.", "Hero shots"),
  p("orbit-360", "360 Orbit", "epic", RefreshCw, "preset-orbit", "Complete revolution around the subject.", "Showcase moments"),
  p("whip-pan-left", "Whip Pan Left", "epic", MoveHorizontal, "preset-pan-left-fast", "Lightning-fast pan to the left.", "Transitions"),
  p("whip-pan-right", "Whip Pan Right", "epic", MoveHorizontal, "preset-pan-right-fast", "Lightning-fast pan to the right.", "Transitions"),
  p("rack-focus", "Rack Focus", "epic", Crosshair, "preset-pulse", "Focus shifts between foreground and background.", "Shifting attention"),
  p("bullet-time", "Bullet Time", "epic", CircleDot, "preset-orbit", "Camera circles a frozen moment.", "Iconic action"),
  p("steadicam", "Steadicam", "epic", Move, "preset-drift", "Smooth, gliding motion through space.", "Long takes"),
  p("dutch-angle", "Dutch Angle", "epic", RotateCw, "preset-dutch", "Tilted horizon for unease.", "Suspense, villains"),
  p("birds-eye", "Bird's Eye", "epic", Eye, "preset-pulse", "Straight-down top view.", "Establishing, abstract"),
  p("worms-eye", "Worm's Eye", "epic", Eye, "preset-pulse", "Looking straight up from the ground.", "Towering presence"),
  p("jib-up", "Jib Up", "epic", ArrowUpRight, "preset-tilt-up", "Smooth crane move upward.", "Lyrical reveals"),
  p("jib-down", "Jib Down", "epic", ArrowDownRight, "preset-tilt-down", "Smooth crane move downward.", "Settling in"),

  // Effects
  p("flood", "Flood", "effects", Droplets, "preset-rise", "Water rapidly fills the scene.", "Disaster moments"),
  p("freezing", "Freezing", "effects", Snowflake, "preset-pulse", "Subject and scene crystallize with ice.", "Stop-time effect"),
  p("melting", "Melting", "effects", Droplets, "preset-melt", "Subject liquefies and drips down.", "Surreal transitions"),
  p("burning", "Burning", "effects", Flame, "preset-flicker", "Flames consume the subject.", "Destruction"),
  p("explosion", "Explosion", "effects", Sparkles, "preset-burst", "Sudden expanding blast.", "Action peaks"),
  p("diamond", "Diamond", "effects", Hexagon, "preset-pulse", "Subject becomes faceted crystal.", "Luxury reveals"),
  p("crystal", "Crystal", "effects", Hexagon, "preset-pulse", "Subject crystallizes into translucent material.", "Magical transforms"),
  p("gold", "Gold", "effects", Star, "preset-pulse", "Subject turns to molten or solid gold.", "Status, wealth"),
  p("silver", "Silver", "effects", Star, "preset-pulse", "Subject becomes liquid silver.", "Sleek transformations"),
  p("bronze", "Bronze", "effects", Star, "preset-pulse", "Subject becomes patinated bronze.", "Heroic statues"),
  p("disintegration", "Disintegration", "effects", Sparkles, "preset-disintegrate", "Subject crumbles into particles.", "Vanishing"),
  p("pixelation", "Pixelation", "effects", Layers, "preset-pulse", "Reality breaks into digital squares.", "Glitch art"),
  p("glitch", "Glitch", "effects", Zap, "preset-glitch", "Digital corruption tears the image.", "Cyberpunk"),
  p("hologram", "Hologram", "effects", Layers, "preset-flicker", "Subject becomes flickering projection.", "Sci-fi"),
  p("thunder-god", "Thunder God", "effects", Zap, "preset-flicker", "Lightning crackles around subject.", "Power moments"),
  p("lightning", "Lightning", "effects", Zap, "preset-flicker", "Bolts strike across the frame.", "Storms, drama"),
  p("electric", "Electric", "effects", Zap, "preset-flicker", "Crackling electric energy surrounds subject.", "Power-up"),
  p("plasma", "Plasma", "effects", Zap, "preset-pulse", "Glowing plasma fields ripple.", "Sci-fi energy"),
  p("levitation", "Levitation", "effects", Wand2, "preset-float", "Subject floats off the ground.", "Magic, weightlessness"),
  p("gravity-pull", "Gravity Pull", "effects", ArrowDownRight, "preset-rise", "Objects pulled toward a center.", "Forces of nature"),
  p("anti-gravity", "Anti-Gravity", "effects", ArrowUpRight, "preset-float", "Things drift upward instead of falling.", "Dreams, sci-fi"),
  p("floating", "Floating", "effects", Wand2, "preset-float", "Subject hovers gently in mid-air.", "Serenity, magic"),
  p("ink-spread", "Ink Spread", "effects", Droplets, "preset-melt", "Ink blooms and spreads through frame.", "Stylized intros"),
  p("watercolor", "Watercolor", "effects", Droplets, "preset-pulse", "Scene painted in soft watercolor wash.", "Artistic"),
  p("oil-paint", "Oil Paint", "effects", Droplets, "preset-pulse", "Scene rendered with oil-paint texture.", "Painterly"),
  p("sketch", "Sketch", "effects", Aperture, "preset-pulse", "Scene becomes pencil sketch.", "Storyboard look"),
  p("smoke", "Smoke", "effects", Cloud, "preset-drift", "Smoke curls through the frame.", "Mood, mystery"),
  p("fog", "Fog", "effects", Cloud, "preset-drift", "Heavy fog rolls across the scene.", "Atmosphere"),
  p("mist", "Mist", "effects", Cloud, "preset-drift", "Fine mist softens the air.", "Romance, dreams"),
  p("dust", "Dust", "effects", Cloud, "preset-drift", "Dust particles catch the light.", "Western, decay"),
  p("bloom", "Bloom", "effects", Sun, "preset-pulse", "Highlights glow and bleed into shadows.", "Dreamy"),
  p("lens-flare", "Lens Flare", "effects", Sun, "preset-flicker", "Streaks of light hit the lens.", "Cinematic warmth"),
  p("light-leak", "Light Leak", "effects", Sun, "preset-flicker", "Warm light bleeds across frame edges.", "Vintage"),
  p("prism", "Prism", "effects", Hexagon, "preset-pulse", "Light splits into spectrum colors.", "Trippy reveals"),
  p("time-freeze", "Time Freeze", "effects", Pause, "preset-pulse", "All motion stops mid-action.", "Bullet time setup"),
  p("slow-motion", "Slow Motion", "effects", Rewind, "preset-pulse", "Action plays at extreme slow speed.", "Drama, beauty"),
  p("speed-ramp", "Speed Ramp", "effects", FastForward, "preset-pulse", "Speed shifts from slow to fast mid-shot.", "Action edits"),
  p("reverse", "Reverse", "effects", Rewind, "preset-pulse", "Footage plays backward.", "Surreal, comedy"),
  p("portal", "Portal", "effects", CircleDot, "preset-pulse", "Glowing doorway opens to elsewhere.", "Sci-fi, fantasy"),
  p("teleport", "Teleport", "effects", Sparkles, "preset-burst", "Subject vanishes and reappears.", "Magic moments"),
  p("morph", "Morph", "effects", GitMerge, "preset-pulse", "Subject smoothly transforms shape.", "Transformations"),

  // Catch the Pulse
  p("paparazzi", "Paparazzi", "pulse", Camera, "preset-flicker", "Camera flashes burst around subject.", "Celebrity moments"),
  p("rap-flex", "Rap Flex", "pulse", Music, "preset-pulse", "Confident, swaggering pose energy.", "Music videos"),
  p("catwalk", "Catwalk", "pulse", Shirt, "preset-pan-right", "Confident runway strut down a line.", "Fashion"),
  p("boxing", "Boxing", "pulse", Swords, "preset-shake", "Aggressive close-quarters fight energy.", "Sports drama"),
  p("car-chasing", "Car Chasing", "pulse", FastForward, "preset-shake", "High-speed pursuit feel.", "Action"),
  p("glam", "Glam", "pulse", Sparkles, "preset-flicker", "Glossy, high-fashion lighting.", "Beauty, fashion"),
  p("agent-reveal", "Agent Reveal", "pulse", Drama, "preset-dolly-out", "Confident hero/villain unveiling.", "Cinematic intros"),
  p("hero-landing", "Hero Landing", "pulse", Drama, "preset-burst", "Iconic ground-impact pose.", "Superhero"),
  p("villain-entrance", "Villain Entrance", "pulse", Drama, "preset-dolly-in", "Menacing slow approach.", "Antagonist intros"),
  p("dance-battle", "Dance Battle", "pulse", Music, "preset-pulse", "High-energy competitive dance.", "Music"),
  p("concert-stage", "Concert Stage", "pulse", Radio, "preset-flicker", "Stage lights, crowd energy.", "Live performance"),
  p("street-style", "Street Style", "pulse", Shirt, "preset-drift", "Urban, candid fashion vibe.", "Lookbooks"),
  p("martial-arts", "Martial Arts", "pulse", Swords, "preset-shake", "Choreographed combat energy.", "Action"),
  p("surfing", "Surfing", "pulse", Waves, "preset-drift", "Wave-riding fluid motion.", "Sports"),
  p("skateboarding", "Skateboarding", "pulse", Trophy, "preset-shake-soft", "Trick-and-flow skate energy.", "Sports"),
  p("fashion-reveal", "Fashion Reveal", "pulse", Shirt, "preset-pulse", "Outfit unveiling moment.", "Fashion drops"),
  p("red-carpet", "Red Carpet", "pulse", Star, "preset-flicker", "Premiere arrival glamour.", "Events"),

  // Mix
  p("mix-thunder-lev", "Thunder God × Levitation", "mix", Zap, "preset-float", "Lightning crackles as subject floats.", "Power reveals"),
  p("mix-action-fire", "Action Run × Set on Fire", "mix", Flame, "preset-flicker", "Sprinting subject trails flames.", "Hero moments"),
  p("mix-disint-lev", "Disintegration × Levitation", "mix", Sparkles, "preset-float", "Subject dissolves while floating up.", "Endings"),
  p("mix-freeze-explode", "Freezing × Explosion", "mix", Snowflake, "preset-burst", "Ice forms then shatters violently.", "Power finishes"),
  p("mix-diamond-lightning", "Diamond × Lightning", "mix", Hexagon, "preset-flicker", "Crystal subject crackling with bolts.", "Luxury power"),
  p("mix-glitch-holo", "Glitch × Hologram", "mix", Layers, "preset-glitch", "Flickering projection corrupts.", "Cyberpunk"),
  p("mix-smoke-light", "Smoke × Light Leak", "mix", Cloud, "preset-flicker", "Smoke catches warm light streaks.", "Moody atmosphere"),
  p("mix-crystal-prism", "Crystal × Prism", "mix", Hexagon, "preset-pulse", "Crystal refracts rainbow light.", "Magical"),
  p("mix-ink-morph", "Ink Spread × Morph", "mix", GitMerge, "preset-melt", "Ink bloom transforms shape.", "Stylized transitions"),
  p("mix-bullet-slow", "Bullet Time × Slow Motion", "mix", CircleDot, "preset-orbit", "Frozen action with circling camera.", "Iconic action"),
  p("mix-fpv-speed", "FPV Drone × Speed Ramp", "mix", Plane, "preset-pan-right-fast", "Drone shot with shifting speeds.", "Action edits"),
  p("mix-dutch-glitch", "Dutch Angle × Glitch", "mix", RotateCw, "preset-glitch", "Tilted frame with digital tearing.", "Suspense, sci-fi"),
  p("mix-paparazzi-glam", "Paparazzi × Glam", "mix", Sparkles, "preset-flicker", "Flashing lights on glossy subject.", "Celebrity drops"),
];

export const getPresetsByGroup = (group: PresetGroupId) =>
  PRESETS.filter((p) => p.group === group);

/**
 * Hero presets featured on the homepage hero row — these are the ones the admin
 * can bulk auto-generate via Fal.ai. All other presets are upload-only.
 */
export const HERO_PRESET_IDS: string[] = [
  "dolly-zoom",
  "bullet-time",
  "orbit-360",
  "crash-zoom-in",
  "whip-pan-right",
  "fpv-drone",
  "levitation",
  "explosion",
  "disintegration",
  "glitch",
  "lightning",
  "mix-bullet-slow",
];

/** Every built-in preset is video-eligible — admin can upload an MP4 for any of them. */
export const ALL_PRESET_IDS: string[] = PRESETS.map((p) => p.id);

export const getPresetVideoUrl = (id: string): string | null => {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/preset-previews/${id}.mp4`;
};

// ---------- Custom (admin-created) presets ----------

export interface CustomPresetRow {
  id: string;
  label: string;
  group_id: string;
  icon_name: string;
  description: string;
  best_for: string;
  anim_class: string | null;
  created_at: string;
}

export const customRowToPreset = (row: CustomPresetRow): Preset => ({
  id: row.id,
  label: row.label,
  group: (row.group_id as PresetGroupId),
  icon: getIconByName(row.icon_name),
  animation: row.anim_class || "preset-pulse",
  description: row.description,
  bestFor: row.best_for,
});

export const loadCustomPresets = async (): Promise<Preset[]> => {
  const { data, error } = await supabase
    .from("custom_presets")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("loadCustomPresets", error);
    return [];
  }
  return (data as CustomPresetRow[]).map(customRowToPreset);
};

/** React Query hook returning built-ins merged with custom presets. */
export const useAllPresets = () => {
  const { data: customs = [], ...rest } = useQuery({
    queryKey: ["custom-presets"],
    queryFn: loadCustomPresets,
    staleTime: 60_000,
  });
  return { presets: [...PRESETS, ...customs], customs, ...rest };
};
