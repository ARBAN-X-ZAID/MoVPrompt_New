// Shared credit charging helpers for edge functions.
// All charges go through SECURITY DEFINER RPCs using the service role.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

let _admin: SupabaseClient | null = null;
function admin() {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _admin;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
  }
}

const _adminCache = new Map<string, { at: number; isAdmin: boolean }>();
const ADMIN_TTL = 5 * 60_000;

async function isAdminUser(userId: string): Promise<boolean> {
  const cached = _adminCache.get(userId);
  if (cached && Date.now() - cached.at < ADMIN_TTL) return cached.isAdmin;
  const { data } = await admin()
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  const isAdmin = !!data;
  _adminCache.set(userId, { at: Date.now(), isAdmin });
  return isAdmin;
}

export async function chargeCredits(opts: {
  userId: string;
  amount: number;
  reason: string;
  refId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<number> {
  if (!opts.amount || opts.amount <= 0) return 0;
  // Admins are exempt from credit charges.
  if (await isAdminUser(opts.userId)) return 0;
  const { data, error } = await admin().rpc(opts.idempotencyKey ? "charge_credits_idempotent" : "charge_credits", {
    _user_id: opts.userId,
    _amount: opts.amount,
    _reason: opts.reason,
    _ref_id: opts.refId ?? null,
    _metadata: opts.metadata ?? null,
    ...(opts.idempotencyKey ? { _idempotency_key: opts.idempotencyKey } : {}),
  });
  if (error) {
    if ((error.message || "").includes("insufficient_credits")) {
      throw new InsufficientCreditsError();
    }
    throw error;
  }
  return data as number;
}

export async function refundCredits(opts: {
  userId: string;
  amount: number;
  reason: string;
  refId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  if (!opts.amount || opts.amount <= 0) return;
  await admin().rpc(opts.idempotencyKey ? "refund_credits_idempotent" : "refund_credits", {
    _user_id: opts.userId,
    _amount: opts.amount,
    _reason: opts.reason,
    _ref_id: opts.refId ?? null,
    _metadata: opts.metadata ?? null,
    ...(opts.idempotencyKey ? { _idempotency_key: opts.idempotencyKey } : {}),
  });
}

type PriceRow = { key: string; kind: "flat" | "per_second"; amount: number };
let _priceCache: { at: number; rows: Map<string, PriceRow> } | null = null;
const PRICE_TTL = 60_000;

async function loadPrices(): Promise<Map<string, PriceRow>> {
  if (_priceCache && Date.now() - _priceCache.at < PRICE_TTL) return _priceCache.rows;
  const { data } = await admin().from("credit_prices").select("key, kind, amount");
  const map = new Map<string, PriceRow>();
  (data || []).forEach((r: any) => map.set(r.key, { key: r.key, kind: r.kind, amount: Number(r.amount) }));
  _priceCache = { at: Date.now(), rows: map };
  return map;
}

export async function priceFor(key: string, fallback = 0): Promise<number> {
  const m = await loadPrices();
  const r = m.get(key);
  return r ? Math.ceil(r.amount) : fallback;
}

export async function videoCost(provider: string, durationSeconds: number): Promise<number> {
  const m = await loadPrices();
  const r = m.get(`video.${provider}`);
  const rate = r ? r.amount : 15; // sensible default
  const dur = Math.max(1, Math.min(60, Math.round(durationSeconds || 5)));
  return Math.max(1, Math.ceil(rate * dur));
}

export function insufficientResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "insufficient_credits",
      message: "You're out of credits. Top up to continue.",
    }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
