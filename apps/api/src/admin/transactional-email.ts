import type { AuthEmail } from "@movprompt/auth";
import type { MongoDatabase } from "@movprompt/db";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import { ADMIN_COLLECTIONS as A, adminError } from "./security.js";

export function validateTransactionalEmail(value: Document) {
  if (!["verify-email", "reset-password"].includes(value.emailPurpose))
    return adminError(
      "email_purpose_required",
      "Choose a supported authentication-email purpose.",
      400,
    );
  for (const locale of ["en", "ar"]) {
    const title = String(value.title?.[locale] ?? "");
    const body = String(value.body?.[locale] ?? "");
    if (/[\r\n]/.test(title) || title.includes("{{"))
      return adminError(
        "email_subject_invalid",
        "Subjects cannot contain newlines or template tokens.",
        400,
      );
    const tokens = [...body.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) =>
      match[1]!.trim(),
    );
    if (
      !tokens.includes("actionUrl") ||
      tokens.some((token) => !["name", "actionUrl"].includes(token)) ||
      body.replace(/{{\s*(name|actionUrl)\s*}}/g, "").includes("{{")
    )
      return adminError(
        "email_tokens_invalid",
        "Each language must include {{actionUrl}}. Only {{name}} and {{actionUrl}} are supported.",
        400,
      );
  }
}

/** The new publication supersedes earlier active templates of the same purpose;
 * every superseded revision remains in publication history. */
export async function retirePriorTransactionalEmails(
  database: MongoDatabase,
  currentId: ObjectId,
  purpose: string,
  session: ClientSession,
  now: Date,
) {
  const previous = await database.db
    .collection(A.content)
    .find(
      {
        _id: { $ne: currentId },
        kind: "transactional-email",
        emailPurpose: purpose,
        status: "published",
      },
      { session },
    )
    .toArray();
  for (const row of previous) {
    const next = {
      ...row,
      status: "archived",
      revision: Number(row.revision) + 1,
      updatedAt: now,
    };
    await database.db
      .collection(A.content)
      .replaceOne({ _id: row._id, revision: row.revision }, next, { session });
    await database.db.collection(A.contentVersions).insertOne(
      {
        contentId: row._id,
        definition: next,
        revision: next.revision,
        createdAt: now,
      },
      { session },
    );
  }
}

export function createAuthenticationEmailRenderer(
  database: MongoDatabase,
  environment: Readonly<Record<string, string | undefined>>,
) {
  return async (
    email: AuthEmail,
  ): Promise<{ subject: string; text: string } | null> => {
    if (environment.ADMIN_EMAIL_ENABLED !== "true") return null;
    const purpose =
      email.type === "verify-email" ? "verify-email" : "reset-password";
    const row = await database.db.collection(A.content).findOne(
      {
        kind: "transactional-email",
        emailPurpose: purpose,
        status: "published",
      },
      { sort: { publishedAt: -1 } },
    );
    if (!row) return null;
    validateTransactionalEmail(row);
    const user = await database.db
      .collection("users")
      .findOne({ email: email.to }, { projection: { locale: 1 } });
    const locale = user?.locale === "ar" ? "ar" : "en";
    const values: Record<string, string> = {
      name: email.name,
      actionUrl: email.url,
    };
    return {
      subject: row.title[locale],
      text: String(row.body[locale]).replace(
        /{{\s*(name|actionUrl)\s*}}/g,
        (_, token: string) => values[token] ?? "",
      ),
    };
  };
}
