import type { AuthEmail, AuthEmailSender } from "@movprompt/auth";
import * as nodemailer from "nodemailer";

export type SmtpEmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  user?: string;
  password?: string;
};

export type AuthEmailDelivery = {
  available: boolean;
  sendEmail: AuthEmailSender;
};

function positivePort(value: string | undefined): number {
  const parsed = Number(value ?? "587");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535");
  }
  return parsed;
}

export function smtpEmailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpEmailConfig {
  const host = env.SMTP_HOST?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!host) throw new Error("SMTP_HOST is required when authentication is enabled");
  if (!from) throw new Error("EMAIL_FROM is required when authentication is enabled");

  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD?.trim();
  if (Boolean(user) !== Boolean(password)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together");
  }

  return {
    host,
    from,
    port: positivePort(env.SMTP_PORT),
    secure: env.SMTP_SECURE?.trim().toLowerCase() === "true",
    ...(user && password ? { user, password } : {}),
  };
}

function emailCopy(email: AuthEmail): { subject: string; text: string; html: string } {
  const action = email.type === "verify-email" ? "Verify your MovPrompt email" : "Reset your MovPrompt password";
  const introduction =
    email.type === "verify-email"
      ? "Use the secure link below to verify your email address."
      : "Use the secure link below to reset your password.";
  const safeName = email.name.replace(/[<>&"']/g, "");
  const safeUrl = email.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  return {
    subject: action,
    text: `Hello ${email.name},\n\n${introduction}\n\n${email.url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>${introduction}</p><p><a href="${safeUrl}">${action}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  };
}

export function createSmtpAuthEmailSender(config: SmtpEmailConfig): AuthEmailSender {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user && config.password
      ? { auth: { user: config.user, pass: config.password } }
      : {}),
  });

  return async (email) => {
    const copy = emailCopy(email);
    await transporter.sendMail({
      from: config.from,
      to: email.to,
      ...copy,
    });
  };
}

/**
 * Authentication remains usable without an SMTP provider because the current
 * first-campaign policy defers verification. Email actions still fail at the
 * delivery boundary instead of reporting a reset or verification as sent.
 */
export function createAuthEmailDeliveryFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AuthEmailDelivery {
  if (!env.SMTP_HOST?.trim()) {
    return {
      available: false,
      sendEmail: async () => {
        throw new Error("authentication_email_delivery_unavailable");
      },
    };
  }

  return {
    available: true,
    sendEmail: createSmtpAuthEmailSender(smtpEmailConfigFromEnv(env)),
  };
}
