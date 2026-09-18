import type { AuthPublicCapability, MovPromptAuth } from "@movprompt/auth";
import { z } from "zod";

const AuthenticatedSessionSchema = z
  .object({
    user: z
      .object({
        id: z.string().min(1),
        email: z.email(),
        emailVerified: z.boolean(),
        name: z.string(),
        role: z.enum(["user", "admin"]).optional(),
      })
      .passthrough(),
    session: z.object({ id: z.string().min(1) }).passthrough(),
  })
  .passthrough();

export type AuthenticatedSession = z.infer<typeof AuthenticatedSessionSchema>;

export interface AuthGateway {
  handle(request: Request): Promise<Response>;
  getSession(headers: Headers): Promise<AuthenticatedSession | null>;
  publicCapability?: AuthPublicCapability;
}

export function createBetterAuthGateway(auth: MovPromptAuth, publicCapability: AuthPublicCapability): AuthGateway {
  return {
    handle: (request) => auth.handler(request),
    publicCapability,
    async getSession(headers) {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;
      return AuthenticatedSessionSchema.parse(session);
    },
  };
}
