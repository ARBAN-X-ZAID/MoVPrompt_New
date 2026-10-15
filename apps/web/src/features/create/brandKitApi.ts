import { BrandKitRecordSchema, SaveBrandKitRequestSchema, type SaveBrandKitRequest } from "@movprompt/contracts";

const origin = () => (import.meta.env.VITE_API_ORIGIN?.trim() || "").replace(/\/$/, "");
async function responseJson(response: Response) {
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error?.message || "The brand kit could not be saved.");
  return value;
}
export const brandKitApi = {
  async logo(id: string) {
    const response = await fetch(`${origin()}/api/v1/brand-kits/${encodeURIComponent(id)}/logo`, { credentials: "include" });
    if (!response.ok) { await responseJson(response); throw new Error("The saved logo is unavailable."); }
    return response.blob();
  },
  async list() {
    const value = await responseJson(await fetch(`${origin()}/api/v1/brand-kits`, { credentials: "include" }));
    return BrandKitRecordSchema.array().parse(value.kits);
  },
  async save(input: SaveBrandKitRequest, key: string) {
    const value = await responseJson(await fetch(`${origin()}/api/v1/brand-kits`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(SaveBrandKitRequestSchema.parse(input)),
    }));
    return BrandKitRecordSchema.parse(value.kit);
  },
};
