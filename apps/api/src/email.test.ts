import { describe, expect, it } from "vitest";
import { smtpEmailConfigFromEnv } from "./email.js";

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
});
