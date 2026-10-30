import { useEffect, useState } from "react";

export function usePasswordCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  function capture(error: unknown) {
    const value = error as {
      code?: string;
      retryAfter?: number;
      message?: string;
    };
    if (value?.code?.toUpperCase() === "PASSWORD_COOLDOWN") {
      const delay =
        value.retryAfter ??
        Number(value.message?.match(/(\d+) seconds/)?.[1] ?? 300);
      setNow(Date.now());
      setUntil(Date.now() + delay * 1000);
    }
  }
  return { seconds, capture };
}
