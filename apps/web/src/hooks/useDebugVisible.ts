// Gate developer-only UI: visible when `?debug=1` is in the URL,
// or when the current user has the `admin` role. End users never see it.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useDebugVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  });

  useEffect(() => {
    if (visible) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("has_role", { _role: "admin" });
      if (!cancelled && data === true) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return visible;
}
