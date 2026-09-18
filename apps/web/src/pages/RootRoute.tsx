import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

import { CinematicHero } from "@/components/hero/CinematicHero";
import { useAuth } from "@/hooks/useAuth";

export default function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-live="polite"
      >
        <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-primary" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  return user ? <Navigate to="/create" replace /> : <CinematicHero />;
}
