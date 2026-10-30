import { AdminCustomerMutationSchema, AdminDurationAvailabilitySchema } from "@movprompt/contracts";
import { TemplateStateInputSchema } from "./template-service.js";

/** Shared endpoints contain powerful actions. Approve the parsed action, never the path alone. */
export function isRoutineAdminMutation(method: string, pathname: string, body: unknown): boolean {
  if (method !== "POST") return false;
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
