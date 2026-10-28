import { describe, expect, it } from "vitest";
import { createServer } from "node:net";
import { createSmtpAuthEmailSender } from "../email.js";
import { validateTransactionalEmail } from "./transactional-email.js";

describe("safe authentication email templates", () => {
  const value = {
    emailPurpose: "verify-email",
    title: { en: "Verify your email", ar: "تأكيد البريد" },
    body: {
      en: "Hello {{name}}\n{{actionUrl}}",
      ar: "مرحباً {{name}}\n{{actionUrl}}",
    },
  };
  it("requires the secure action token in both languages and rejects arbitrary bindings", () => {
    expect(() => validateTransactionalEmail(value)).not.toThrow();
    for (const body of [
      { en: "Missing link", ar: value.body.ar },
      { en: "{{actionUrl}} {{password}}", ar: value.body.ar },
    ])
      expect(() => validateTransactionalEmail({ ...value, body })).toThrow();
    expect(() =>
      validateTransactionalEmail({
        ...value,
        title: { ...value.title, en: "Unsafe\r\nBcc: another@example.test" },
      }),
    ).toThrow();
    expect(() =>
      validateTransactionalEmail({ ...value, emailPurpose: "arbitrary" }),
    ).toThrow();
  });
  it("sends reviewed plain-text/escaped HTML through a real local SMTP boundary", async () => {
    const received: string[] = [];
    const server = createServer((socket) => {
      socket.write("220 localhost SMTP test\r\n");
      let buffer = "";
      let data = false;
      let message = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        let newline: number;
        while ((newline = buffer.indexOf("\r\n")) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 2);
          if (data) {
            if (line === ".") {
              received.push(message);
              message = "";
              data = false;
              socket.write("250 accepted locally\r\n");
            } else message += line + "\r\n";
            continue;
          }
          if (/^EHLO|HELO/.test(line))
            socket.write("250-localhost\r\n250 8BITMIME\r\n");
          else if (line === "DATA") {
            data = true;
            socket.write("354 send data\r\n");
          } else if (line === "QUIT") {
            socket.end("221 bye\r\n");
          } else socket.write("250 OK\r\n");
        }
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("smtp_test_unavailable");
      const send = createSmtpAuthEmailSender(
        {
          host: "127.0.0.1",
          port: address.port,
          secure: false,
          from: "MovPrompt QA <no-reply@example.test>",
        },
        async (email) => ({
          subject: "Reviewed verification",
          text: `Hello <${email.name}>\n${email.url}`,
        }),
      );
      await send({
        type: "verify-email",
        to: "customer@example.test",
        name: "QA",
        url: "https://app.example.test/verify?token=synthetic",
      });
      expect(received).toHaveLength(1);
      expect(received[0]).toContain("Subject: Reviewed verification");
      expect(received[0]).toContain("Hello &lt;QA&gt;");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
