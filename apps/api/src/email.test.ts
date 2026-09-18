import { describe, expect, it } from "vitest";
import { createAuthEmailDeliveryFromEnv, smtpEmailConfigFromEnv } from "./email.js";

describe("SMTP auth email configuration", () => {
  it("supports Mailpit without credentials", () => {
    expect(
      smtpEmailConfigFromEnv({
        SMTP_HOST: "mailpit",
        SMTP_PORT: "1025",
        SMTP_SECURE: "false",
        EMAIL_FROM: "MovPrompt <no-reply@example.test>",
      }),
    ).toEqual({
      host: "mailpit",
      port: 1025,
      secure: false,
      from: "MovPrompt <no-reply@example.test>",
    });
  });

  it("fails closed on partial SMTP credentials", () => {
    expect(() =>
      smtpEmailConfigFromEnv({
        SMTP_HOST: "smtp.example.test",
        EMAIL_FROM: "no-reply@example.test",
        SMTP_USER: "username-only",
      }),
    ).toThrow("SMTP_USER and SMTP_PASSWORD must be configured together");
  });

  it("keeps authentication startup available without SMTP and rejects email delivery", async () => {
    const delivery = createAuthEmailDeliveryFromEnv({});

    expect(delivery.available).toBe(false);
    await expect(delivery.sendEmail({
      type: "reset-password",
      to: "creator@example.test",
      name: "Creator",
      url: "https://app.example.test/reset",
    })).rejects.toThrow("authentication_email_delivery_unavailable");
  });

  it("keeps partially configured SMTP fail-closed", () => {
    expect(() => createAuthEmailDeliveryFromEnv({
      SMTP_HOST: "smtp.example.test",
      EMAIL_FROM: "no-reply@example.test",
      SMTP_USER: "username-only",
    })).toThrow("SMTP_USER and SMTP_PASSWORD must be configured together");
  });
});
