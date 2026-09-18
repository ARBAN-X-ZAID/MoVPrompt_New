import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  model_id: string;
  display_name: string;
  available: boolean;
  first_available_at: string | null;
};

export type AvailabilityMap = Record<string, { available: boolean; firstAvailableAt: string | null; displayName: string }>;

const CACHE_KEY = "movprompt:model-availability:v1";
const SEEN_KEY = "movprompt:model-availability:seen:v1";

function readCache(): AvailabilityMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(map: AvailabilityMap) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

function markSeen(modelId: string) {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const seen = raw ? JSON.parse(raw) : {};
    seen[modelId] = true;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch { /* ignore */ }
}

function wasSeen(modelId: string): boolean {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return !!(raw && JSON.parse(raw)[modelId]);
  } catch { return false; }
}

export function useModelAvailability(): AvailabilityMap {
  const [map, setMap] = useState<AvailabilityMap>(() => readCache());

  useEffect(() => {
    let mounted = true;

    const applyRows = (rows: Row[]) => {
      const next: AvailabilityMap = {};
      for (const r of rows) {
        next[r.model_id] = {
          available: r.available,
          firstAvailableAt: r.first_available_at,
          displayName: r.display_name,
        };
        // First-time toast when a tracked model flips on.
        if (r.available && !wasSeen(r.model_id)) {
          toast.success(`${r.display_name} is now available — try it from the model picker.`);
          markSeen(r.model_id);
        }
      }
      if (!mounted) return;
      setMap(next);
      writeCache(next);
    };

    supabase
      .from("model_availability")
      .select("model_id, display_name, available, first_available_at")
      .then(({ data }) => { if (data) applyRows(data as Row[]); });

    const channel = supabase
      .channel("model-availability")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "model_availability" },
        () => {
          supabase
            .from("model_availability")
            .select("model_id, display_name, available, first_available_at")
            .then(({ data }) => { if (data) applyRows(data as Row[]); });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return map;
}
