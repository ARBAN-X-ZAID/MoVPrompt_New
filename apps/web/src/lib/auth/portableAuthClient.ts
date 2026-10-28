import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { AUTH_REQUEST_TIMEOUT_MS } from "./requestTimeout";
import type { Session, User } from "better-auth";

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_ORIGIN?.trim();
  if (!configured) return window.location.origin;
  try {
    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol))
      throw new Error("unsupported protocol");
    return url.origin;
  } catch {
    throw new Error("VITE_API_ORIGIN must be an absolute HTTP(S) origin");
  }
}
const authClient = createAuthClient({
  plugins: [twoFactorClient()],
  baseURL: `${apiOrigin()}/api/auth`,
  fetchOptions: {
    credentials: "include",
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  },
});

// The legacy web tsconfig disables strictNullChecks, which makes the SDK's
// conditional React session inference resolve to never. Keep the runtime proxy
// intact and declare the standard server session plus the installed MFA field.
type PortableSession = {
  user: User & { twoFactorEnabled?: boolean };
  session: Session;
};
type SessionState = Omit<ReturnType<typeof authClient.useSession>, "data"> & {
  data: PortableSession | null;
};
export const portableAuthClient = authClient as Omit<
  typeof authClient,
  "useSession"
> & {
  useSession: () => SessionState;
};

export type PortableAuthUser = NonNullable<
  ReturnType<typeof portableAuthClient.useSession>["data"]
>["user"];

export function authErrorMessage(error: unknown): string {
  if (!error) return "Authentication could not be completed. Please try again.";
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Authentication could not be completed. Please try again.";
}

export function signInFailureKind(
  error: unknown,
): "credentials" | "unreachable" | "other" {
  const record =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown; status?: unknown; cause?: unknown })
      : {};
  const code = typeof record.code === "string" ? record.code : "";
  const status = typeof record.status === "number" ? record.status : 0;
  const cause = record.cause instanceof Error ? record.cause.message : "";
  const message = `${authErrorMessage(error)} ${cause}`;
  if (
    code === "INVALID_EMAIL_OR_PASSWORD" ||
    /invalid email or password|invalid credentials|incorrect email or password/i.test(
      message,
    ) ||
    (status === 401 && /password|credential|email/i.test(message))
  ) {
    return "credentials";
  }
  if (
    /failed to fetch|networkerror|load failed|network request failed|econnrefused/i.test(
      message,
    )
  ) {
    return "unreachable";
  }
  return "other";
}
