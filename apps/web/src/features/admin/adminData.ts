import type { AdminResource } from "@movprompt/contracts";
import { adminEnum, fieldLabels } from "./labels";
export type RecordData = Record<string, unknown>;
export const object = (value: unknown): RecordData =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordData)
    : {};
export const label = (name: string, ar: boolean) =>
  fieldLabels[name]?.[ar ? 1 : 0] ??
  name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
export const listFields: Record<AdminResource, string[]> = {
  customers: ["name", "email", "status", "createdAt"],
  campaigns: ["title", "customerName", "status", "updatedAt"],
  "business-renders": [
    "purpose",
    "status",
    "worstCaseMicrousd",
    "currency",
    "createdAt",
  ],
  generations: ["campaignTitle", "status", "chargedCredits", "createdAt"],
  templates: ["slug", "publishingState", "category", "updatedAt"],
  assets: ["value", "kind", "customerName", "updatedAt"],
  "owned-media": ["name", "kind", "status", "updatedAt"],
  payments: ["providerReference", "status", "amountMinor", "credits"],
  credits: ["kind", "customerName", "delta", "balanceAfter"],
  "financial-requests": ["kind", "status", "customerName", "createdAt"],
  support: ["subject", "category", "status", "priority"],
  moderation: ["category", "status", "reason", "createdAt"],
  content: ["title", "kind", "status", "updatedAt"],
  reports: ["kind", "status", "rowCount", "createdAt"],
  operations: ["name", "status", "retryCount", "updatedAt"],
  audit: ["action", "outcome", "createdAt"],
};
export function compact(value: unknown, locale: string, field?: string) {
  if (value && typeof value === "object") {
    const record = object(value);
    return String(record[locale] ?? record.name ?? "—");
  }
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value))
    return new Date(value).toLocaleDateString(
      locale === "ar" ? "ar-KW" : "en-KW",
    );
  return adminEnum(String(value ?? "—"), field, locale === "ar");
}
