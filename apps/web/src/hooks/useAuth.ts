import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { isFeatureEnabled } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { attributeStoredRefIfAny } from "@/lib/referrals";
import { portableAuthActions } from "@/lib/auth/portableAuthActions";
import { portableAuthClient } from "@/lib/auth/portableAuthClient";

export type AuthUser = User & {
  role?: "user" | "admin";
  name?: string;
  image?: string | null;
  emailVerified?: boolean;
};
export type AuthSession = Session | { user: AuthUser; session: Record<string, unknown> };

export function projectPortableUser(input: NonNullable<ReturnType<typeof portableAuthClient.useSession>["data"]>["user"]): AuthUser {
  const role = "role" in input && (input.role === "admin" || input.role === "user") ? input.role : "user";
  const name = input.name?.trim() || input.email.split("@")[0] || "Creator";
  const image = input.image ?? null;
  return {
    ...input,
    role,
    name,
    image,
    app_metadata: { provider: "portable" },
    user_metadata: { full_name: name, avatar_url: image },
    aud: "authenticated",
    created_at: input.createdAt instanceof Date ? input.createdAt.toISOString() : String(input.createdAt),
  } as AuthUser;
}

function usePortableAuth() {
  const sessionState = portableAuthClient.useSession();
  const sessionUser = sessionState.data?.user;
  const user = useMemo(
    () => sessionUser ? projectPortableUser(sessionUser) : null,
    [sessionUser],
  );
  const session = useMemo(
    () => sessionState.data && user
      ? ({ ...sessionState.data, user } as unknown as AuthSession)
      : null,
    [sessionState.data, user],
  );
  return {
    user,
    session,
    loading: sessionState.isPending,
    error: sessionState.error,
    refresh: sessionState.refetch,
    signOut: async () => {
      await portableAuthActions.signOut();
      await sessionState.refetch();
    },
  };
}

function useLegacyAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_IN" && nextSession?.user) attributeStoredRefIfAny().catch(() => undefined);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return {
    user: user as AuthUser | null,
    session: session as AuthSession | null,
    loading,
    error: null,
    refresh: async () => undefined,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
}

export const useAuth = isFeatureEnabled("portableAuth") ? usePortableAuth : useLegacyAuth;
