import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { isFeatureEnabled } from "@/config/features";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  fallback?: React.ReactNode;
}


export const AuthGuard = ({ children, requireAdmin = false, fallback }: AuthGuardProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "admin";

  // Still loading auth or role check
  if (loading) {
    if (fallback) {
      return (
        <>
          <TopNav />
          {fallback}
        </>
      );
    }
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }


  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const target = requireAdmin && !isFeatureEnabled("portableAuth")
      ? "/admin/login"
      : `/auth?next=${encodeURIComponent(next)}`;
    return <Navigate to={target} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
