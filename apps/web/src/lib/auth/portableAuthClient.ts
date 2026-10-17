import { createAuthClient } from "better-auth/react";
import { AUTH_REQUEST_TIMEOUT_MS } from "./requestTimeout";

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_ORIGIN?.trim();
  if (!configured) return window.location.origin;
  try {
    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported protocol");
    return url.origin;
  } catch {
    throw new Error("VITE_API_ORIGIN must be an absolute HTTP(S) origin");
  }
}
export const portableAuthClient = createAuthClient({
  baseURL: `${apiOrigin()}/api/auth`,
  fetchOptions: {
    credentials: "include",
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  },
});

export type PortableAuthUser = NonNullable<
  ReturnType<typeof portableAuthClient.useSession>["data"]
>["user"];

export function authErrorMessage(error: unknown): string {
  if (!error) return "Authentication could not be completed. Please try again.";
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Authentication could not be completed. Please try again.";
}

export function signInFailureKind(error: unknown): "credentials" | "unreachable" | "other" {
  const record = typeof error === "object" && error !== null
    ? error as { code?: unknown; status?: unknown; cause?: unknown }
    : {};
  const code = typeof record.code === "string" ? record.code : "";
  const status = typeof record.status === "number" ? record.status : 0;
  const cause = record.cause instanceof Error ? record.cause.message : "";
  const message = `${authErrorMessage(error)} ${cause}`;
  if (
    code === "INVALID_EMAIL_OR_PASSWORD"
    || /invalid email or password|invalid credentials|incorrect email or password/i.test(message)
    || (status === 401 && /password|credential|email/i.test(message))
  ) {
    return "credentials";
  }
  if (/failed to fetch|networkerror|load failed|network request failed|econnrefused/i.test(message)) {
    return "unreachable";
  }
  return "other";
}
