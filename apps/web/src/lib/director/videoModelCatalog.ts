// Frontend catalog — re-exports from the SHARED single-source-of-truth module
// at `supabase/functions/_shared/videoModelCatalog.ts`. The shared module is
// dependency-free and consumed by both the model picker UI and the
// director-agent edge function so they can never drift.

export {
  MODEL_CATALOG,
  CATALOG_BY_ID,
  getCapabilities,
  catalogPromptLines,
} from "../../../../../supabase/functions/_shared/videoModelCatalog";

export type {
  ModelCapabilities,
  ModelStrength,
  VideoModelFamily,
  ResolutionTier,
  SpeedTier,
  CostTier,
  InputMode,
} from "../../../../../supabase/functions/_shared/videoModelCatalog";
