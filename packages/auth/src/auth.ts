import { type MongoDatabase } from "@movprompt/db";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

import type { AuthEnvironment } from "./config.js";
import { createAuthProvisioningHooks, createAuthUserProvisioner } from "./provisioning.js";

export interface AuthEmail {
  type: "verify-email" | "reset-password";
  to: string;
  name: string;
  url: string;
}

export type AuthEmailSender = (email: AuthEmail) => Promise<void>;

export interface CreateAuthInput {
  db: MongoDatabase;
  environment: AuthEnvironment;
  sendEmail: AuthEmailSender;
}

export class AuthenticationEmailDeliveryError extends Error {
  constructor(readonly type: AuthEmail["type"]) {
    super("MovPrompt could not send the authentication email. Please try again.");
    this.name = "AuthenticationEmailDeliveryError";
  }
}

/**
 * Better Auth must only acknowledge an email action after the configured
 * delivery boundary accepted it. This prevents a rejected SMTP request from
 * becoming an unusable but apparently successful reset or verification flow.
 */
export async function dispatchAuthenticationEmail(sender: AuthEmailSender, email: AuthEmail): Promise<void> {
  try {
    await sender(email);
  } catch {
    throw new AuthenticationEmailDeliveryError(email.type);
  }
}

/**
 * Builds the Better Auth handler used by the API at `/api/auth/*`.
 *
 * Better Auth maps its logical `id` field to MongoDB's native ObjectId `_id`.
 * API consumers receive the standard 24-character hexadecimal representation.
 */
export function createMovPromptAuth(input: CreateAuthInput) {
  const { environment } = input;
  const isFirstCampaignVerificationDeferred =
    environment.firstCampaignVerificationPolicy === "deferred_until_after_first_campaign";
  const provisioningHooks = createAuthProvisioningHooks(createAuthUserProvisioner(input.db, {
    requireEmailVerificationForStarter: !isFirstCampaignVerificationDeferred,
  }));
  const socialProviders = {
    ...(environment.google ? { google: environment.google } : {}),
    ...(environment.apple ? { apple: environment.apple } : {}),
  };

  return betterAuth({
    appName: "MovPrompt",
    baseURL: environment.baseUrl,
    secret: environment.secret,
    trustedOrigins: environment.trustedOrigins,
    database: mongodbAdapter(input.db.db, { client: input.db.client }),
    databaseHooks: provisioningHooks,
    user: {
      modelName: "users",
      additionalFields: {
        role: {
          type: ["user", "admin"],
          required: false,
          defaultValue: "user",
          input: false,
        },
        locale: {
          type: "string",
          required: false,
          defaultValue: "en",
        },
        legacySupabaseUserId: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    session: {
      modelName: "sessions",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    account: {
      modelName: "accounts",
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "apple", "credential"],
        allowDifferentEmails: false,
      },
    },
    verification: {
      modelName: "verifications",
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: !isFirstCampaignVerificationDeferred,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await dispatchAuthenticationEmail(input.sendEmail, {
          type: "reset-password",
          to: user.email,
          name: user.name,
          url,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: !isFirstCampaignVerificationDeferred,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await dispatchAuthenticationEmail(input.sendEmail, {
          type: "verify-email",
          to: user.email,
          name: user.name,
          url,
        });
      },
    },
    socialProviders,
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: environment.baseUrl.startsWith("https://"),
      },
    },
  });
}

export type MovPromptAuth = ReturnType<typeof createMovPromptAuth>;
