import { supabase } from "@/integrations/supabase/client";

const REF_STORAGE_KEY = "movprompt_ref_code";
const REF_TTL_DAYS = 30;

interface StoredRef { code: string; ts: number; }

export function captureRefFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref")?.trim().toLowerCase();
    if (!code || code.length < 4 || code.length > 32) return;
    const payload: StoredRef = { code, ts: Date.now() };
    localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(payload));
    // Strip the param from the URL so it doesn't get shared further.
    params.delete("ref");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  } catch {}
}

export function readStoredRef(): string | null {
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed?.code) return null;
    const age = (Date.now() - (parsed.ts || 0)) / (1000 * 60 * 60 * 24);
    if (age > REF_TTL_DAYS) {
      localStorage.removeItem(REF_STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearStoredRef(): void {
  try { localStorage.removeItem(REF_STORAGE_KEY); } catch {}
}

/** Call after a successful signup or first-time sign-in. Idempotent. */
export async function attributeStoredRefIfAny(): Promise<boolean> {
  const code = readStoredRef();
  if (!code) return false;
  const { data, error } = await supabase.rpc("attribute_referral", { _code: code });
  if (!error) clearStoredRef();
  return !!data;
}

export async function getOrCreateMyReferralCode(): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_my_referral_code");
  if (error) throw error;
  return data as unknown as string;
}

export interface ReferralRow {
  id: string;
  referred_user_id: string;
  code: string;
  created_at: string;
}

export async function listMyReferrals(): Promise<ReferralRow[]> {
  const { data, error } = await supabase
    .from("referrals")
    .select("id,referred_user_id,code,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReferralRow[];
}

export function buildReferralUrl(code: string): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}
