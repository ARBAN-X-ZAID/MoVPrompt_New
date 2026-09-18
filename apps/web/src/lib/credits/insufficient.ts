// Centralized 402/insufficient-credits handler.
// Detects errors from edge functions and surfaces a clear toast with a link
// to the billing page.
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFnError } from "@/lib/edgeFnError";

type AnyErr = unknown;

function isInsufficientShape(serverMessage?: string): boolean {
  if (!serverMessage) return false;
  return /insufficient_credits|out of credits|need.*credits|insufficient credits/i.test(
    serverMessage,
  );
}

/**
 * Inspect an error and, if it's a 402/insufficient-credits failure, show a
 * "Need X credits, you have Y" toast linking to /account/billing.
 * Returns true if it handled the error.
 */
export async function notifyInsufficientCredits(err: AnyErr): Promise<boolean> {
  // Fast-path: native Error with a 402-ish message string.
  const message =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : "";

  const parsed = await parseEdgeFnError(err);
  const status = parsed.status;
  const serverMessage = parsed.serverMessage || message;

  const looks402 =
    status === 402 ||
    isInsufficientShape(serverMessage) ||
    /\b402\b/.test(message);
  if (!looks402) return false;

  // Best-effort: fetch current balance to show "you have Y".
  let balance: number | null = null;
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (uid) {
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", uid)
        .maybeSingle();
      balance = data?.balance ?? 0;
    }
  } catch {
    /* ignore */
  }

  // Try to extract "need X" from server message.
  const needMatch = serverMessage?.match(/need(?:ed)?[^\d]*(\d+)/i);
  const need = needMatch ? Number(needMatch[1]) : null;

  const desc =
    need != null && balance != null
      ? `Need ${need} credits — you have ${balance}.`
      : balance != null
        ? `You have ${balance} credits left.`
        : "Top up to keep generating.";

  toast.error("Out of credits", {
    description: desc,
    action: {
      label: "View billing",
      onClick: () => {
        window.location.assign("/account/billing");
      },
    },
  });
  return true;
}
