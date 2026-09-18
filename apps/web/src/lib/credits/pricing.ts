// Mirrors the server-side credit_prices catalog for UI estimates.
// These are *display defaults* — the authoritative price lives in the DB,
// fetched on mount by `usePricing` so admins can tune without a redeploy.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PriceRow = { key: string; kind: "flat" | "per_second"; amount: number };

const FALLBACK: Record<string, PriceRow> = {
  director_chat_text: { key: "director_chat_text", kind: "flat", amount: 1 },
  director_chat_multimodal: { key: "director_chat_multimodal", kind: "flat", amount: 3 },
  image_generation: { key: "image_generation", kind: "flat", amount: 5 },
  write_ad_scene: { key: "write_ad_scene", kind: "flat", amount: 2 },
};

let _cache: Map<string, PriceRow> | null = null;

export function usePricing() {
  const [prices, setPrices] = useState<Map<string, PriceRow>>(_cache || new Map(Object.entries(FALLBACK)));
  useEffect(() => {
    if (_cache) return;
    void supabase
      .from("credit_prices")
      .select("key, kind, amount")
      .then(({ data }) => {
        const map = new Map<string, PriceRow>();
        (data || []).forEach((r: any) => map.set(r.key, { key: r.key, kind: r.kind, amount: Number(r.amount) }));
        _cache = map;
        setPrices(map);
      });
  }, []);
  return prices;
}

export function estimateVideoCost(prices: Map<string, PriceRow>, provider: string, durationSec: number): number {
  const row = prices.get(`video.${provider}`);
  const rate = row?.amount ?? 15;
  const dur = Math.max(1, Math.min(60, Math.round(durationSec || 5)));
  return Math.max(1, Math.ceil(rate * dur));
}

export function flatCost(prices: Map<string, PriceRow>, key: string): number {
  const row = prices.get(key);
  return Math.ceil(row?.amount ?? FALLBACK[key]?.amount ?? 0);
}
