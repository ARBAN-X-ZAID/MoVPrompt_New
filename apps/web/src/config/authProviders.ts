import type { AuthCapability } from "@movprompt/contracts";

export type SocialAuthProvider = AuthCapability["configuredProviders"][number];

/** The server capability is the only authority for social sign-in visibility. */
export function isSocialAuthProviderEnabled(
  capability: AuthCapability | null | undefined,
  provider: SocialAuthProvider,
): boolean {
  return capability?.configuredProviders.includes(provider) ?? false;
}

export function enabledSocialAuthProviders(
  capability?: AuthCapability | null,
): SocialAuthProvider[] {
  return (["google", "apple"] as const).filter((provider) =>
    isSocialAuthProviderEnabled(capability, provider),
  );
}
