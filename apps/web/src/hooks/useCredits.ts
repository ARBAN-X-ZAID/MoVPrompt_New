import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureEnabled } from "@/config/features";
import { portableCreatorApi } from "@/lib/api/portableApiClient";

export type LedgerEntry = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  ref_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function useCredits() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [balance, setBalance] = useState<number | null>(null);
  const [reserved, setReserved] = useState(0);
  const [available, setAvailable] = useState<number | null>(null);
  const [starterRenderAvailable, setStarterRenderAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setBalance(null);
      setReserved(0);
      setAvailable(null);
      setStarterRenderAvailable(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    if (isFeatureEnabled("portableAuth")) {
      try {
        const summary = await portableCreatorApi.credits();
        setBalance(summary.balance);
        setReserved(summary.reserved);
        setAvailable(summary.available);
        setStarterRenderAvailable(summary.starterRenderAvailable);
      } catch {
        setBalance(null);
        setReserved(0);
        setAvailable(null);
        setStarterRenderAvailable(false);
        setError("Credit balance is temporarily unavailable.");
      } finally {
        setLoading(false);
      }
      return;
    }
    // Trigger daily grant lazily, then read the balance.
    try {
      await supabase.rpc("grant_daily_credits_if_due", { _user_id: userId });
    } catch {
      /* ignore — grant is best-effort */
    }
    const { data, error: balanceError } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (balanceError) {
      setBalance(null);
      setReserved(0);
      setAvailable(null);
      setStarterRenderAvailable(false);
      setError("Credit balance is temporarily unavailable.");
      setLoading(false);
      return;
    }
    setBalance(data?.balance ?? 0);
    setReserved(0);
    setAvailable(data?.balance ?? 0);
    setStarterRenderAvailable(false);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime balance updates
  useEffect(() => {
    if (!userId || isFeatureEnabled("portableAuth")) return;
    const ch = supabase
      .channel(`credits-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new as { balance?: number } | undefined)?.balance;
          if (typeof next === "number") setBalance(next);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId]);

  return { balance, reserved, available, starterRenderAvailable, loading, error, refresh };
}

export async function fetchLedger(userId: string, limit = 50): Promise<LedgerEntry[]> {
  if (isFeatureEnabled("portableAuth")) {
    const summary = await portableCreatorApi.credits();
    return summary.ledger.slice(0, limit).map((entry) => ({
      id: entry.id,
      delta: entry.delta,
      balance_after: entry.balanceAfter,
      reason: entry.reason,
      ref_id: entry.referenceId,
      metadata: entry.referenceType ? { referenceType: entry.referenceType } : null,
      created_at: entry.createdAt,
    }));
  }
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id, delta, balance_after, reason, ref_id, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Credit activity is temporarily unavailable.");
  return (data || []) as LedgerEntry[];
}
