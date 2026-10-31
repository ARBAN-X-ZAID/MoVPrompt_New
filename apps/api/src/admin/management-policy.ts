import { AdminCustomerMutationSchema, AdminDurationAvailabilitySchema, AdminFinancialRequestSchema, AdminReviewSchema, AdminTemplateDetailsSchema } from "@movprompt/contracts";
import { TemplateNameInputSchema, TemplateStateInputSchema } from "./template-service.js";

/** Shared endpoints contain powerful actions. Approve the parsed action, never the path alone. */
export function isRoutineAdminMutation(method: string, pathname: string, body: unknown): boolean {
  if (method !== "POST") return false;
  if (/^\/api\/v1\/admin\/templates\/[a-f\d]{24}\/name$/i.test(pathname)) return TemplateNameInputSchema.safeParse(body).success;
  if (/^\/api\/v1\/admin\/templates\/[a-f\d]{24}\/details$/i.test(pathname)) return AdminTemplateDetailsSchema.safeParse(body).success;
  if (/^\/api\/v1\/admin\/customers\/[a-f\d]{24}\/actions$/i.test(pathname)) {
    const parsed = AdminCustomerMutationSchema.safeParse(body);
    return parsed.success && ["profile", "suspend", "restore"].includes(parsed.data.action);
  }
  if (/^\/api\/v1\/admin\/templates\/[a-f\d]{24}\/availability$/i.test(pathname))
    return AdminDurationAvailabilitySchema.safeParse(body).success;
  if (/^\/api\/v1\/admin\/templates\/[a-f\d]{24}\/state$/i.test(pathname)) {
    const parsed = TemplateStateInputSchema.safeParse(body);
    return parsed.success && ["unpublish", "restore-publication"].includes(parsed.data.action);
  }
  return false;
}

export const WALLET_REQUEST_KINDS = ["credit-adjustment", "generation-restoration", "cash-refund"];

/** Approval authorization uses the stored request kind, not a client-supplied kind. */
export async function isWalletAdminMutation(
  method: string,
  pathname: string,
  body: unknown,
  requestKind: (id: string) => Promise<unknown>,
): Promise<boolean> {
  if (method !== "POST") return false;
  if (/^\/api\/v1\/admin\/finance\/(preview|requests)$/.test(pathname)) {
    const parsed = AdminFinancialRequestSchema.safeParse(body);
    return parsed.success && WALLET_REQUEST_KINDS.includes(parsed.data.kind);
  }
  const review = /^\/api\/v1\/admin\/finance\/requests\/([a-f\d]{24})\/review$/i.exec(pathname);
  return Boolean(review && AdminReviewSchema.safeParse(body).success &&
    WALLET_REQUEST_KINDS.includes(String(await requestKind(review[1]!))));
}
