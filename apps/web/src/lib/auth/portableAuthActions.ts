import { portableAuthClient } from "./portableAuthClient";

export interface PortableAuthActions {
  signInEmail(input: { email: string; password: string; callbackURL: string }): Promise<unknown>;
  signUpEmail(input: { email: string; password: string; name: string; callbackURL: string }): Promise<unknown>;
  signInSocial(input: { provider: "google" | "apple"; callbackURL: string }): Promise<unknown>;
  requestPasswordReset(input: { email: string; redirectTo: string }): Promise<unknown>;
  sendVerificationEmail(input: { email: string; callbackURL: string }): Promise<unknown>;
  resetPassword(input: { newPassword: string; token: string }): Promise<unknown>;
  signOut(): Promise<unknown>;
}

export const portableAuthActions: PortableAuthActions = {
  signInEmail: (input) => portableAuthClient.signIn.email(input),
  signUpEmail: (input) => portableAuthClient.signUp.email(input),
  signInSocial: (input) => portableAuthClient.signIn.social(input),
  requestPasswordReset: (input) => portableAuthClient.requestPasswordReset(input),
  sendVerificationEmail: (input) => portableAuthClient.sendVerificationEmail(input),
  resetPassword: (input) => portableAuthClient.resetPassword(input),
  signOut: () => portableAuthClient.signOut(),
};
